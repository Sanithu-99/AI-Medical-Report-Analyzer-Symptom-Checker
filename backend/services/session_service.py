from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any, Dict

from bson import ObjectId

from ..database import get_collection
from ..settings import get_settings


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class SessionService:
    def __init__(self) -> None:
        settings = get_settings()
        self.collection_name = settings.session_log_collection
        self.refresh_ttl_hours = settings.refresh_token_ttl_hours

    def _collection(self):
        return get_collection(self.collection_name)

    async def log_session(
        self,
        user_id: str,
        fingerprint: str,
        ip_address: str,
        location: Dict[str, Any] | None,
        refresh_token: str,
        suspicious: bool = False,
    ) -> str:
        payload = {
            "user_id": user_id,
            "fingerprint": fingerprint,
            "ip": ip_address,
            "location": location or {},
            "refresh_token_hash": hash_refresh_token(refresh_token),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_seen_at": datetime.now(timezone.utc).isoformat(),
            "suspicious": suspicious,
            "revoked": False,
        }
        result = await self._collection().insert_one(payload)
        return str(result.inserted_id)

    async def touch_session(self, refresh_token: str, ip_address: str) -> None:
        hashed = hash_refresh_token(refresh_token)
        await self._collection().update_one(
            {"refresh_token_hash": hashed},
            {"$set": {"last_seen_at": datetime.now(timezone.utc).isoformat(), "ip": ip_address}},
        )

    async def revoke_session(self, refresh_token: str) -> None:
        hashed = hash_refresh_token(refresh_token)
        await self._collection().update_one(
            {"refresh_token_hash": hashed},
            {"$set": {"revoked": True, "revoked_at": datetime.now(timezone.utc).isoformat()}},
        )

    async def validate_refresh(self, refresh_token: str) -> Dict[str, Any] | None:
        hashed = hash_refresh_token(refresh_token)
        record = await self._collection().find_one({"refresh_token_hash": hashed, "revoked": False})
        if not record:
            return None
        created_at = record.get("created_at")
        if created_at:
            try:
                created_dt = datetime.fromisoformat(created_at)
                if datetime.now(timezone.utc) - created_dt > timedelta(hours=self.refresh_ttl_hours):
                    await self._collection().update_one(
                        {"_id": record["_id"]},
                        {"$set": {"revoked": True}},
                    )
                    return None
            except ValueError:
                return record
        return record


session_service = SessionService()
