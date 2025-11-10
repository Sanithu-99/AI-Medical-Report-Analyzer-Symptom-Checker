from datetime import datetime, timedelta, timezone

from ..database import get_collection
from ..security import hash_password, verify_password
from ..settings import get_settings


async def ensure_default_user() -> None:
    settings = get_settings()
    if not settings.default_user_email or not settings.default_user_password:
        return

    collection = get_collection("users")
    existing = await collection.find_one({"email": settings.default_user_email})
    hashed_password = hash_password(settings.default_user_password)

    if existing:
        updates = {}
        if not verify_password(settings.default_user_password, existing.get("password_hash", "")):
            updates["password_hash"] = hashed_password
        if existing.get("role") != "admin":
            updates["role"] = "admin"
        if updates:
            await collection.update_one({"_id": existing["_id"]}, {"$set": updates})
        return

    user_doc = {
        "email": settings.default_user_email,
        "password_hash": hashed_password,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "role": "admin",
        "plan": "institution",
        "plan_expiry": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
        "mfa_enabled": False,
    }
    await collection.insert_one(user_doc)
