"""Passwordless email sign-in (magic link) via Resend.

There are no passwords in Matrix Builder. A user enters their email; we send a short-lived,
signed magic link; clicking it proves ownership of the inbox and mints the same HS256 session
JWT the rest of the API uses. This *is* the account-recovery mechanism — losing access just
means requesting a new link (no password to reset, no password hashes to breach).

Email is sent through Resend's REST API with stdlib only (no new dependency). If
``RESEND_API_KEY`` is unset, the link is logged instead (dev mode).
"""

from __future__ import annotations

import json
import time
import urllib.request
from urllib.parse import quote

import jwt

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_RESEND_ENDPOINT = "https://api.resend.com/emails"
_MAGIC_PURPOSE = "email-magic-link"


class EmailAuthError(Exception):
    """Raised when a magic-link token is missing, malformed, or expired."""


def make_magic_token(email: str, settings: Settings | None = None) -> str:
    """Mint a short-lived signed token that proves intent to sign in as ``email``."""
    settings = settings or get_settings()
    now = int(time.time())
    payload = {
        "sub": f"email:{email.lower()}",
        "email": email.lower(),
        "purpose": _MAGIC_PURPOSE,
        "iss": "matrix-builder",
        "iat": now,
        "exp": now + settings.email_link_ttl_seconds,
    }
    return jwt.encode(payload, settings.supabase_jwt_secret, algorithm=settings.supabase_jwt_algorithm)


def verify_magic_token(token: str, settings: Settings | None = None) -> str:
    """Verify a magic-link token and return the email, or raise ``EmailAuthError``."""
    settings = settings or get_settings()
    try:
        claims = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=[settings.supabase_jwt_algorithm],
            options={"require": ["sub", "exp"], "verify_aud": False},
        )
    except jwt.PyJWTError as exc:
        raise EmailAuthError(f"invalid or expired link: {exc}") from exc
    if claims.get("purpose") != _MAGIC_PURPOSE or not claims.get("email"):
        raise EmailAuthError("not a sign-in link")
    return str(claims["email"])


def build_magic_link(token: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    base = settings.public_app_url.rstrip("/")
    return f"{base}/auth/verify?token={quote(token)}"


def _magic_email_html(link: str) -> str:
    """A clean, professional confirmation email (inline styles for client compatibility)."""
    return f"""<!doctype html><html><body style="margin:0;background:#02170f;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#02170f;padding:40px 16px">
   <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#06281c;border:1px solid rgba(123,255,184,.16);border-radius:20px;overflow:hidden">
      <tr><td style="padding:36px 36px 8px">
        <div style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;border:1px solid rgba(34,200,120,.6);border-radius:10px;color:#53f39d;font-size:20px">&#9671;</div>
        <h1 style="margin:22px 0 8px;color:#f7fff9;font-size:24px;font-weight:600">Confirm your email</h1>
        <p style="margin:0;color:#a7c9b8;font-size:15px;line-height:1.6">
          Click the button below to sign in to <strong style="color:#f7fff9">Matrix Builder</strong>.
          This link expires in 15 minutes and can be used once.
        </p>
      </td></tr>
      <tr><td style="padding:24px 36px 8px" align="center">
        <a href="{link}" style="display:inline-block;background:linear-gradient(180deg,#53f39d,#22c878);color:#04140c;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px">Confirm &amp; sign in</a>
      </td></tr>
      <tr><td style="padding:18px 36px 36px">
        <p style="margin:0 0 6px;color:#6f9482;font-size:12px">Or paste this link into your browser:</p>
        <p style="margin:0;word-break:break-all"><a href="{link}" style="color:#53f39d;font-size:12px">{link}</a></p>
        <p style="margin:22px 0 0;color:#6f9482;font-size:12px;line-height:1.6">
          If you didn&#39;t request this, you can safely ignore this email — no account is created until you confirm.
        </p>
      </td></tr>
    </table>
    <p style="margin:18px 0 0;color:#46604f;font-size:11px">Matrix Builder &middot; Give AI coders a contract, not a prompt.</p>
   </td></tr>
  </table>
</body></html>"""


def send_magic_link(email: str, link: str, settings: Settings | None = None) -> bool:
    """Send the confirmation email via Resend. Returns True if dispatched (or logged in dev)."""
    settings = settings or get_settings()
    if not settings.resend_api_key:
        # Dev / unconfigured: don't fail sign-in — surface the link in logs.
        logger.warning("RESEND_API_KEY unset; magic link (dev only): %s", link)
        return False
    body = json.dumps({
        "from": settings.email_from,
        "to": [email],
        "subject": "Confirm your email · Matrix Builder",
        "html": _magic_email_html(link),
    }).encode("utf-8")
    req = urllib.request.Request(
        _RESEND_ENDPOINT,
        data=body,
        method="POST",
        headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return 200 <= resp.status < 300
    except Exception as exc:  # noqa: BLE001 — never leak provider errors to the caller
        logger.error("Resend send failed: %s", exc)
        return False


__all__ = [
    "EmailAuthError",
    "make_magic_token",
    "verify_magic_token",
    "build_magic_link",
    "send_magic_link",
]
