from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated, Any, Dict

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr, Field

from ..database import get_collection
from ..models.user_model import User
from ..security import hash_password, verify_password
from ..security.mfa import generate_totp_secret, provisioning_uri, verify_totp
from ..security.vpn_check import vpn_checker
from ..services.alert_service import log_security_alert
from ..services.session_service import session_service
from ..services.subscription_service import PLAN_MATRIX, subscription_service
from ..settings import get_settings


router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")
settings = get_settings()


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    plan: str = "individual"
    role: str = "user"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    mfa_code: str | None = None
    device_fingerprint: str | None = None


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_expires_in: int
    plan: str
    role: str


class RefreshRequest(BaseModel):
    refresh_token: str
    device_fingerprint: str | None = None


class PlanSelection(BaseModel):
    plan: str = Field(..., pattern="^(individual|clinician|institution)$")


class ProfileUpdate(BaseModel):
    email: EmailStr


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str
    mfa_code: str | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class PasswordResetRequest(BaseModel):
    token: str
    new_password: str


class MFASetupResponse(BaseModel):
    secret: str
    provisioning_uri: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    created_at: str
    role: str
    plan: str
    plan_expiry: str | None


class PlanDetails(BaseModel):
    key: str
    name: str
    monthly_reports: int | None
    symptom_checks: int | None
    features: Dict[str, bool]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(user: User) -> str:
    expire = _now() + timedelta(minutes=settings.access_token_ttl_minutes)
    payload = {
        "sub": user.email,
        "uid": user.id,
        "role": user.role,
        "plan": user.plan,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_refresh_token(user: User) -> str:
    base = secrets.token_urlsafe(64)
    timestamp = str(int(_now().timestamp()))
    return hashlib.sha256(f"{base}:{user.id}:{timestamp}".encode("utf-8")).hexdigest()


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "0.0.0.0"


async def fetch_user(email: str) -> dict[str, Any] | None:
    collection = get_collection("users")
    return await collection.find_one({"email": email})


async def deserialize_user(data: dict[str, Any]) -> User:
    data["_id"] = str(data["_id"])
    return User(**data)


async def update_login_metadata(user_id: ObjectId, ip: str) -> None:
    collection = get_collection("users")
    await collection.update_one(
        {"_id": user_id},
        {"$set": {"last_login_at": _now().isoformat(), "last_login_ip": ip}},
    )


async def ensure_plan_active(user_doc: dict[str, Any]) -> None:
    expiry = user_doc.get("plan_expiry")
    if not expiry:
        return
    try:
        expires_at = datetime.fromisoformat(expiry)
    except ValueError:
        return
    if _now() > expires_at and user_doc.get("plan") != "individual":
        collection = get_collection("users")
        await collection.update_one(
            {"_id": user_doc["_id"]},
            {"$set": {"plan": "individual"}, "$unset": {"plan_expiry": ""}},
        )
        user_doc["plan"] = "individual"
        user_doc["plan_expiry"] = None


def enforce_geo(vpn_result_country: str | None, *, user_id: str | None = None, ip: str | None = None) -> None:
    if not settings.geo_enforcement or not vpn_result_country:
        return
    country = vpn_result_country.upper()
    if settings.restricted_countries and country in settings.restricted_countries:
        raise HTTPException(status_code=403, detail="Logins from your region are not permitted.")
    if settings.allowed_countries and country not in settings.allowed_countries:
        raise HTTPException(status_code=403, detail="Region not allow-listed for this workspace.")


def verify_mfa_if_required(user: User, code: str | None) -> None:
    if not user.mfa_enabled:
        return
    if not code or not user.totp_secret or not verify_totp(user.totp_secret, code):
        raise HTTPException(status_code=401, detail="Valid MFA code required.")


async def issue_tokens(
    user: User,
    request: Request,
    device_fingerprint: str | None,
    vpn_assessment_country: str | None,
) -> TokenPair:
    access = create_access_token(user)
    refresh = create_refresh_token(user)
    fingerprint = device_fingerprint or hashlib.sha256(
        f"{request.headers.get('user-agent','')}{user.email}".encode("utf-8")
    ).hexdigest()

    await session_service.log_session(
        user_id=user.id,
        fingerprint=fingerprint,
        ip_address=get_client_ip(request),
        location={"country": vpn_assessment_country},
        refresh_token=refresh,
        suspicious=False,
    )
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.access_token_ttl_minutes * 60,
        refresh_expires_in=settings.refresh_token_ttl_hours * 3600,
        plan=user.plan,
        role=user.role,
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(user: UserCreate):
    collection = get_collection("users")
    existing = await collection.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists.")

    plan = subscription_service.normalize_plan(user.plan)
    now = _now().isoformat()
    user_doc = {
        "email": user.email,
        "password_hash": hash_password(user.password),
        "created_at": now,
        "plan": plan,
        "role": user.role if user.role in {"user", "clinician", "admin"} else "user",
        "plan_expiry": None,
        "mfa_enabled": False,
    }
    result = await collection.insert_one(user_doc)
    user_doc["_id"] = str(result.inserted_id)
    return UserOut(**user_doc)


@router.post("/login", response_model=TokenPair)
async def login(payload: LoginRequest, request: Request):
    user_doc = await fetch_user(payload.email)
    if not user_doc or not verify_password(payload.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Invalid credentials.")
    await ensure_plan_active(user_doc)

    ip_address = get_client_ip(request)
    vpn_assessment = await vpn_checker.assess(ip_address)
    if vpn_assessment.suspicious:
        await log_security_alert(
            "vpn_blocked_login",
            user_id=str(user_doc["_id"]),
            email=user_doc.get("email"),
            ip=ip_address,
            metadata={"source": vpn_assessment.source, "country": vpn_assessment.country},
        )
        raise HTTPException(status_code=403, detail="VPNs or proxies are not permitted.")
    enforce_geo(vpn_assessment.country, user_id=str(user_doc["_id"]), ip=ip_address)

    user = await deserialize_user(user_doc)
    verify_mfa_if_required(user, payload.mfa_code)
    await update_login_metadata(ObjectId(user.id), ip_address)
    return await issue_tokens(user, request, payload.device_fingerprint, vpn_assessment.country)


@router.post("/token", response_model=TokenPair)
async def oauth_token(
    request: Request,
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
):
    user_doc = await fetch_user(form_data.username)
    if not user_doc or not verify_password(form_data.password, user_doc.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Invalid credentials.")
    await ensure_plan_active(user_doc)

    user = await deserialize_user(user_doc)
    verify_mfa_if_required(user, form_data.client_secret)
    ip_address = get_client_ip(request)
    vpn_assessment = await vpn_checker.assess(ip_address)
    if vpn_assessment.suspicious:
        await log_security_alert(
            "vpn_blocked_oauth",
            user_id=str(user_doc["_id"]),
            email=user_doc.get("email"),
            ip=ip_address,
            metadata={"source": vpn_assessment.source, "country": vpn_assessment.country},
        )
        raise HTTPException(status_code=403, detail="VPNs or proxies are not permitted.")
    enforce_geo(vpn_assessment.country, user_id=str(user_doc["_id"]), ip=ip_address)
    await update_login_metadata(ObjectId(user.id), ip_address)
    return await issue_tokens(user, request, form_data.client_id, vpn_assessment.country)


@router.post("/token/refresh", response_model=TokenPair)
async def refresh_token(payload: RefreshRequest, request: Request):
    session = await session_service.validate_refresh(payload.refresh_token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid refresh token.")
    if payload.device_fingerprint and session.get("fingerprint") != payload.device_fingerprint:
        await log_security_alert(
            "session_device_mismatch",
            user_id=session.get("user_id"),
            email=None,
            ip=get_client_ip(request),
            metadata={"expected": session.get("fingerprint"), "provided": payload.device_fingerprint},
        )
        raise HTTPException(status_code=401, detail="Device mismatch detected.")

    users = get_collection("users")
    user_doc = await users.find_one({"_id": ObjectId(session["user_id"])})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found.")
    await ensure_plan_active(user_doc)

    user = await deserialize_user(user_doc)
    ip_address = get_client_ip(request)
    if session.get("ip") and session["ip"] != ip_address:
        await log_security_alert(
            "session_ip_mismatch",
            user_id=session.get("user_id"),
            email=None,
            ip=ip_address,
            metadata={"previous_ip": session.get("ip")},
        )
        raise HTTPException(status_code=401, detail="Location change detected; please login again.")
    await session_service.touch_session(payload.refresh_token, ip_address)
    vpn_assessment = await vpn_checker.assess(ip_address)
    if vpn_assessment.suspicious:
        await log_security_alert(
            "vpn_blocked_refresh",
            user_id=user.id,
            email=user.email,
            ip=ip_address,
            metadata={"source": vpn_assessment.source, "country": vpn_assessment.country},
        )
        raise HTTPException(status_code=403, detail="VPNs or proxies are not permitted.")
    return await issue_tokens(user, request, payload.device_fingerprint, vpn_assessment.country)


@router.post("/logout")
async def logout(payload: RefreshRequest):
    await session_service.revoke_session(payload.refresh_token)
    return {"detail": "Session revoked."}


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        user_id: str | None = payload.get("uid")
        if user_id is None:
            raise credentials_exception
    except JWTError as exc:  # pragma: no cover
        raise credentials_exception from exc

    collection = get_collection("users")
    user_data = await collection.find_one({"_id": ObjectId(user_id)})
    if not user_data:
        raise credentials_exception

    return await deserialize_user(user_data)


@router.get("/me", response_model=UserOut)
async def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        created_at=current_user.created_at,
        role=current_user.role,
        plan=current_user.plan,
        plan_expiry=current_user.plan_expiry,
    )


@router.put("/profile", response_model=UserOut)
async def update_profile(
    payload: ProfileUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
):
    collection = get_collection("users")
    if payload.email != current_user.email:
        existing = await collection.find_one({"email": payload.email})
        if existing:
            raise HTTPException(status_code=400, detail="Email is already associated with another account.")

    await collection.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {"email": payload.email}},
    )
    updated = await collection.find_one({"_id": ObjectId(current_user.id)})
    updated["_id"] = str(updated["_id"])
    return UserOut(
        id=updated["_id"],
        email=updated["email"],
        created_at=updated["created_at"],
        role=updated.get("role", "user"),
        plan=updated.get("plan", "individual"),
        plan_expiry=updated.get("plan_expiry"),
    )


@router.post("/password/change")
async def change_password(
    payload: PasswordUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
):
    verify_mfa_if_required(current_user, payload.mfa_code)
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from the current password.")

    hashed = hash_password(payload.new_password)
    collection = get_collection("users")
    await collection.update_one({"_id": ObjectId(current_user.id)}, {"$set": {"password_hash": hashed}})
    return {"detail": "Password updated successfully."}


@router.post("/password/forgot")
async def forgot_password(request: ForgotPasswordRequest):
    users = get_collection("users")
    resets = get_collection("password_resets")

    user = await users.find_one({"email": request.email})
    if not user:
        return {"detail": "If an account exists, password reset instructions have been sent."}

    token = secrets.token_urlsafe(48)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires_at = (_now() + timedelta(hours=1)).isoformat()

    await resets.insert_one(
        {
            "user_id": str(user["_id"]),
            "token_hash": token_hash,
            "expires_at": expires_at,
            "created_at": _now().isoformat(),
            "used": False,
        }
    )

    return {
        "detail": "If an account exists, password reset instructions have been sent.",
        "reset_token": token,
    }


@router.post("/password/reset")
async def reset_password(request: PasswordResetRequest):
    resets = get_collection("password_resets")
    users = get_collection("users")

    token_hash = hashlib.sha256(request.token.encode("utf-8")).hexdigest()
    record = await resets.find_one({"token_hash": token_hash})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset token.")

    if record.get("used"):
        raise HTTPException(status_code=400, detail="This password reset token has already been used.")

    expires_at = datetime.fromisoformat(record["expires_at"])
    if _now() > expires_at:
        raise HTTPException(status_code=400, detail="The password reset token has expired.")

    user = await users.find_one({"_id": ObjectId(record["user_id"])})
    if not user:
        raise HTTPException(status_code=400, detail="User associated with this token could not be found.")

    new_hash = hash_password(request.new_password)
    await users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": new_hash}})
    await resets.update_one({"_id": record["_id"]}, {"$set": {"used": True, "used_at": _now().isoformat()}})

    return {"detail": "Password has been reset successfully."}


@router.post("/mfa/setup", response_model=MFASetupResponse)
async def setup_mfa(current_user: Annotated[User, Depends(get_current_user)]):
    if current_user.mfa_enabled and current_user.totp_secret:
        raise HTTPException(status_code=400, detail="MFA already enabled.")

    secret = generate_totp_secret()
    collection = get_collection("users")
    await collection.update_one({"_id": ObjectId(current_user.id)}, {"$set": {"totp_secret": secret}})
    return MFASetupResponse(secret=secret, provisioning_uri=provisioning_uri(current_user.email, secret))


class MFAEnableRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


@router.post("/mfa/enable")
async def enable_mfa(payload: MFAEnableRequest, current_user: Annotated[User, Depends(get_current_user)]):
    collection = get_collection("users")
    doc = await collection.find_one({"_id": ObjectId(current_user.id)})
    secret = doc.get("totp_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="MFA setup not initiated.")
    if not verify_totp(secret, payload.code):
        raise HTTPException(status_code=400, detail="Invalid code.")
    await collection.update_one({"_id": ObjectId(current_user.id)}, {"$set": {"mfa_enabled": True}})
    return {"detail": "MFA enabled."}


@router.post("/mfa/disable")
async def disable_mfa(payload: MFAEnableRequest, current_user: Annotated[User, Depends(get_current_user)]):
    verify_mfa_if_required(current_user, payload.code)
    collection = get_collection("users")
    await collection.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {"mfa_enabled": False}, "$unset": {"totp_secret": ""}},
    )
    return {"detail": "MFA disabled."}


@router.post("/plan/select", response_model=UserOut)
async def select_plan(payload: PlanSelection, current_user: Annotated[User, Depends(get_current_user)]):
    normalized = subscription_service.normalize_plan(payload.plan)
    users = get_collection("users")
    await users.update_one(
        {"_id": ObjectId(current_user.id)},
        {"$set": {"plan": normalized, "plan_expiry": (_now() + timedelta(days=30)).isoformat()}},
    )
    updated = await users.find_one({"_id": ObjectId(current_user.id)})
    updated["_id"] = str(updated["_id"])
    return UserOut(
        id=updated["_id"],
        email=updated["email"],
        created_at=updated["created_at"],
        role=updated.get("role", "user"),
        plan=updated.get("plan", "individual"),
        plan_expiry=updated.get("plan_expiry"),
    )


@router.get("/plans", response_model=list[PlanDetails])
async def list_plans():
    plans = []
    for key, plan in PLAN_MATRIX.items():
        plans.append(
            PlanDetails(
                key=key,
                name=plan.name,
                monthly_reports=plan.monthly_reports,
                symptom_checks=plan.symptom_checks,
                features=plan.features,
            )
        )
    return plans
