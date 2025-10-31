from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr

from ..database import get_collection
from ..models.user_model import User
from ..security import hash_password, verify_password
from ..settings import get_settings


router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    created_at: str


class Token(BaseModel):
    access_token: str
    token_type: str


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    settings = get_settings()
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=60))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> User:
    settings = get_settings()
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        email: str | None = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError as exc:  # pragma: no cover - defensive
        raise credentials_exception from exc

    collection = get_collection("users")
    user_data = await collection.find_one({"email": email})
    if not user_data:
        raise credentials_exception
    
    user_data["_id"] = str(user_data["_id"])
    return User(**user_data)


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(user: UserCreate):
    collection = get_collection("users")
    existing = await collection.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists.")

    now = datetime.utcnow().isoformat()
    user_doc = {
        "email": user.email,
        "password_hash": hash_password(user.password),
        "created_at": now,
    }
    result = await collection.insert_one(user_doc)
    user_doc["_id"] = str(result.inserted_id)
    return UserOut(id=user_doc["_id"], email=user_doc["email"], created_at=user_doc["created_at"])


@router.post("/login", response_model=Token)
async def login(form_data: Annotated[OAuth2PasswordRequestForm, Depends()]):
    collection = get_collection("users")
    user_data = await collection.find_one({"email": form_data.username})
    if not user_data or not verify_password(form_data.password, user_data["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid credentials.")

    access_token = create_access_token({"sub": user_data["email"]})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
async def read_users_me(current_user: Annotated[User, Depends(get_current_user)]):
    return UserOut(id=current_user.id, email=current_user.email, created_at=current_user.created_at)
