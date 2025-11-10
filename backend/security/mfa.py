from __future__ import annotations

import os

import pyotp


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def verify_totp(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    try:
        return totp.verify(code, valid_window=1)
    except Exception:  # pragma: no cover - defensive
        return False


def provisioning_uri(email: str, secret: str) -> str:
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name="Med Analyzr AI")
