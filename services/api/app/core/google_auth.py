"""Sign in with Google → a Matrix Builder session JWT.

The browser obtains a Google **ID token** (Google Identity Services) and POSTs it to
``/api/v1/auth/google``. We verify it against Google's public keys (RS256, audience =
our OAuth client id, issuer = accounts.google.com) and then mint the *same* HS256 session
JWT the rest of the API already accepts (``app.core.auth.verify_token``) — so the Google
user's ``sub`` scopes every row via RLS, exactly like a CLI-minted token.
"""

from __future__ import annotations

import time

import jwt
from jwt import PyJWKClient

from app.core.config import Settings, get_settings

# Google's signing keys + the only issuers we accept.
_GOOGLE_CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

_jwk_client: PyJWKClient | None = None


class GoogleAuthError(Exception):
    """Raised when a Google credential is missing, malformed, or fails verification."""


def _signing_key(credential: str):
    """Resolve the RSA public key Google used to sign this credential (cached JWKS)."""
    global _jwk_client
    if _jwk_client is None:
        _jwk_client = PyJWKClient(_GOOGLE_CERTS_URL)
    return _jwk_client.get_signing_key_from_jwt(credential).key


def verify_google_id_token(credential: str, client_id: str) -> dict:
    """Verify a Google ID token and return its claims, or raise ``GoogleAuthError``."""
    if not credential:
        raise GoogleAuthError("missing Google credential")
    if not client_id:
        raise GoogleAuthError("Google sign-in is not configured")
    try:
        claims = jwt.decode(
            credential,
            _signing_key(credential),
            algorithms=["RS256"],
            audience=client_id,
            options={"require": ["sub", "exp", "aud", "iss"]},
        )
    except jwt.PyJWTError as exc:  # bad signature, expired, wrong audience, missing claims
        raise GoogleAuthError(f"invalid Google credential: {exc}") from exc
    if claims.get("iss") not in _GOOGLE_ISSUERS:
        raise GoogleAuthError("unexpected token issuer")
    if claims.get("email") and claims.get("email_verified") is False:
        raise GoogleAuthError("Google email is not verified")
    return claims


def mint_session_jwt(
    sub: str,
    *,
    email: str | None = None,
    name: str | None = None,
    settings: Settings | None = None,
    ttl_seconds: int | None = None,
) -> tuple[str, int]:
    """Mint the HS256 session JWT the API accepts (sub scopes RLS). Returns (token, exp)."""
    settings = settings or get_settings()
    now = int(time.time())
    exp = now + (ttl_seconds or settings.session_ttl_seconds)
    payload: dict[str, object] = {
        "sub": sub,
        "aud": settings.supabase_jwt_audience,
        "iss": "matrix-builder",
        "iat": now,
        "exp": exp,
    }
    if email:
        payload["email"] = email
    if name:
        payload["name"] = name
    token = jwt.encode(payload, settings.supabase_jwt_secret, algorithm=settings.supabase_jwt_algorithm)
    return token, exp


__all__ = ["GoogleAuthError", "verify_google_id_token", "mint_session_jwt"]
