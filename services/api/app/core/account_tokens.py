"""Short-lived signed tokens for account activation and password reset (HS256, no DB state)."""
from __future__ import annotations

import time

import jwt

from app.core.config import Settings, get_settings

ACTIVATE = "account-activate"
RESET = "password-reset"


class AccountTokenError(Exception):
    """Raised when an activation / reset token is missing, malformed, expired, or wrong-purpose."""


def make_token(email: str, purpose: str, settings: Settings | None = None, *, ttl_seconds: int | None = None) -> str:
    settings = settings or get_settings()
    now = int(time.time())
    ttl = ttl_seconds if ttl_seconds is not None else settings.email_link_ttl_seconds
    payload = {
        "sub": f"account:{email.lower()}",
        "email": email.lower(),
        "purpose": purpose,
        "iss": "matrix-builder",
        "iat": now,
        "exp": now + ttl,
    }
    return jwt.encode(payload, settings.supabase_jwt_secret, algorithm=settings.supabase_jwt_algorithm)


def verify_token(token: str, purpose: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    try:
        claims = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=[settings.supabase_jwt_algorithm],
            options={"require": ["sub", "exp"], "verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise AccountTokenError(f"invalid or expired link: {exc}") from exc
    if claims.get("purpose") != purpose or not claims.get("email"):
        raise AccountTokenError("wrong or missing token purpose")
    return str(claims["email"])


__all__ = ["ACTIVATE", "RESET", "AccountTokenError", "make_token", "verify_token"]
