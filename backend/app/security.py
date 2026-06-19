"""Password hashing (stdlib PBKDF2 — no native deps) and JWT helpers."""
from __future__ import annotations

import hashlib
import hmac
import os
from datetime import datetime, timedelta, timezone

import jwt

from .config import settings

_PBKDF2_ROUNDS = 240_000
_ALGO = "sha256"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac(_ALGO, password.encode(), salt, _PBKDF2_ROUNDS)
    return f"pbkdf2_{_ALGO}${_PBKDF2_ROUNDS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, rounds, salt_hex, hash_hex = stored.split("$")
        assert scheme == f"pbkdf2_{_ALGO}"
        dk = hashlib.pbkdf2_hmac(
            _ALGO, password.encode(), bytes.fromhex(salt_hex), int(rounds)
        )
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, AssertionError):
        return False


def create_access_token(subject: str, role: str = "analyst") -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp()),
        "type": "access",
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
