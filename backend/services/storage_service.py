from __future__ import annotations

import base64
import hashlib
import hmac
import time

from fastapi import HTTPException, status

from ..settings import get_settings


class SignedURLService:
    def __init__(self) -> None:
        self.secret = get_settings().secret_key.encode("utf-8")

    def create_token(self, report_id: str, user_id: str, expires_in: int = 600) -> str:
        expiry = int(time.time()) + expires_in
        payload = f"{report_id}:{user_id}:{expiry}"
        signature = hmac.new(self.secret, payload.encode("utf-8"), hashlib.sha256).digest()
        token = base64.urlsafe_b64encode(payload.encode("utf-8") + b"." + signature).decode("utf-8")
        return token

    def verify_token(self, token: str, report_id: str, user_id: str) -> None:
        try:
            decoded = base64.urlsafe_b64decode(token.encode("utf-8"))
            payload_bytes, signature = decoded.split(b".")
            expected_signature = hmac.new(self.secret, payload_bytes, hashlib.sha256).digest()
            if not hmac.compare_digest(signature, expected_signature):
                raise ValueError("signature mismatch")
            payload = payload_bytes.decode("utf-8")
            stored_report_id, stored_user_id, expiry_str = payload.split(":")
            if stored_report_id != report_id or stored_user_id != user_id:
                raise ValueError("token mismatch")
            if int(expiry_str) < int(time.time()):
                raise ValueError("token expired")
        except Exception as exc:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid download token.") from exc


storage_service = SignedURLService()
