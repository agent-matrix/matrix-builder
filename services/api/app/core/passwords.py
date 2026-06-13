"""Password hashing — stdlib PBKDF2-HMAC-SHA256 (no third-party dependency).

Format: ``pbkdf2_sha256$<iterations>$<salt_b64>$<hash_b64>`` (Django-compatible shape).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

_ALGO = "pbkdf2_sha256"
_ITERATIONS = 600_000  # OWASP 2024 guidance for PBKDF2-HMAC-SHA256
_SALT_BYTES = 16


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


def hash_password(password: str, *, iterations: int = _ITERATIONS) -> str:
    if not password or len(password) < 8:
        raise ValueError("password must be at least 8 characters")
    salt = secrets.token_bytes(_SALT_BYTES)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return f"{_ALGO}${iterations}${_b64(salt)}${_b64(dk)}"


def verify_password(password: str, encoded: str | None) -> bool:
    if not password or not encoded:
        return False
    try:
        algo, iters, salt_b64, hash_b64 = encoded.split("$", 3)
        if algo != _ALGO:
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, int(iters))
    except Exception:  # noqa: BLE001 — any malformed hash is simply a non-match
        return False
    return hmac.compare_digest(dk, expected)


__all__ = ["hash_password", "verify_password"]
