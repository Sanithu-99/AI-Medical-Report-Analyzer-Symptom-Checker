from __future__ import annotations

import base64
import json
import os
from functools import lru_cache
from typing import Any, Dict

from cryptography.hazmat.primitives import hashes, hmac
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from ..settings import get_settings


class EncryptionManager:
    """
    Minimal AES-256-GCM helper used to protect PHI before persisting to MongoDB.
    In production the key should be sourced from an HSM/KMS and rotated regularly.
    """

    def __init__(self, key_material: str):
        decoded = self._decode_key(key_material)
        if len(decoded) not in (16, 24, 32):
            raise ValueError("ENCRYPTION_KEY must be a base64 string representing a 128/192/256-bit key.")
        self.key = decoded

    def encrypt(self, payload: Dict[str, Any]) -> Dict[str, str]:
        data = json.dumps(payload).encode("utf-8")
        nonce = os.urandom(12)
        aesgcm = AESGCM(self.key)
        ciphertext = aesgcm.encrypt(nonce, data, None)
        return {
            "nonce": base64.urlsafe_b64encode(nonce).decode("utf-8"),
            "ciphertext": base64.urlsafe_b64encode(ciphertext).decode("utf-8"),
            "alg": "AESGCM256",
        }

    def decrypt(self, envelope: Dict[str, str]) -> Dict[str, Any]:
        nonce = base64.urlsafe_b64decode(envelope["nonce"])
        ciphertext = base64.urlsafe_b64decode(envelope["ciphertext"])
        aesgcm = AESGCM(self.key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return json.loads(plaintext)

    def create_hmac_token(self, value: str, salt: bytes | None = None) -> str:
        salt_bytes = salt or os.urandom(16)
        h = hmac.HMAC(self.key if len(self.key) >= 32 else salt_bytes, hashes.SHA256())
        h.update(salt_bytes + value.encode("utf-8"))
        digest = h.finalize()
        return base64.urlsafe_b64encode(salt_bytes + digest).decode("utf-8")

    @staticmethod
    def _decode_key(key_material: str) -> bytes:
        normalized = key_material.strip()
        try:
            return base64.urlsafe_b64decode(normalized)
        except Exception as exc:  # pragma: no cover - defensive
            raise ValueError("ENCRYPTION_KEY must be base64 encoded.") from exc


@lru_cache
def get_encryption_manager() -> EncryptionManager:
    settings = get_settings()
    return EncryptionManager(settings.encryption_key)
