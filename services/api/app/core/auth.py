"""Supabase JWT verification (Batch C1).

Matrix Builder uses Supabase Auth; the FastAPI API verifies the bearer JWT itself (HS256 with
the project's JWT secret) and extracts the user id (``sub``). That user id is what scopes every
row via RLS — see ``app.db.engine.session_scope``.
"""

from __future__ import annotations

import jwt
from fastapi import Depends, Header, HTTPException, status

from app.core.config import Settings, get_settings


class AuthError(Exception):
    """Raised when a token is missing, malformed, expired, or fails verification."""


def verify_token(token: str, settings: Settings | None = None) -> dict:
    """Verify a Supabase JWT and return its claims, or raise ``AuthError``."""
    settings = settings or get_settings()
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=[settings.supabase_jwt_algorithm],
            audience=settings.supabase_jwt_audience,
            options={"require": ["sub", "exp"]},
        )
    except jwt.PyJWTError as exc:  # expired, bad signature, wrong audience, missing claims
        raise AuthError(str(exc)) from exc


def user_id_from_token(token: str, settings: Settings | None = None) -> str:
    claims = verify_token(token, settings)
    sub = claims.get("sub")
    if not sub:
        raise AuthError("token has no subject")
    return str(sub)


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthError("missing bearer token")
    return authorization.split(" ", 1)[1].strip()


def current_user_id(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> str:
    """FastAPI dependency: the authenticated Supabase user id (raises 401 otherwise)."""
    try:
        return user_id_from_token(_bearer(authorization), settings)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def current_claims(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> dict:
    """FastAPI dependency: the full verified token claims (sub, email, …), or 401."""
    try:
        return verify_token(_bearer(authorization), settings)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


__all__ = ["AuthError", "verify_token", "user_id_from_token", "current_user_id", "current_claims"]
