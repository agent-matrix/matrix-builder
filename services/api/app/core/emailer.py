"""Transactional email via Resend (stdlib only) + professional templates.

If ``RESEND_API_KEY`` is unset, emails are logged instead of sent (dev mode). A 403 from
Resend almost always means ``EMAIL_FROM`` is not on a verified domain (resend.com/domains).
"""
from __future__ import annotations

import json
import urllib.error
import urllib.request
from urllib.parse import quote

from app.core.config import Settings, get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
_RESEND_ENDPOINT = "https://api.resend.com/emails"


def build_link(path: str, token: str, settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    base = settings.public_app_url.rstrip("/")
    return f"{base}{path}?token={quote(token)}"


def _send_via_sdk(to: str, subject: str, html: str, settings: Settings) -> bool | None:
    """Send via the official Resend SDK. Returns True/False, or None if the SDK isn't available."""
    try:
        import resend  # type: ignore
    except Exception:  # noqa: BLE001 — SDK not installed; caller falls back to HTTP
        return None
    try:
        resend.api_key = settings.resend_api_key
        resp = resend.Emails.send({"from": settings.email_from, "to": [to], "subject": subject, "html": html})
        ok = bool(resp and (resp.get("id") if isinstance(resp, dict) else getattr(resp, "id", None)))
        if not ok:
            logger.error("Resend SDK returned no id: %r", resp)
        return ok
    except Exception as exc:  # noqa: BLE001
        logger.error("Resend SDK send failed: %s", exc)
        return False


def _send_via_http(to: str, subject: str, html: str, settings: Settings) -> bool:
    """Fallback HTTP path with a real User-Agent (Cloudflare 1010 blocks Python-urllib's UA)."""
    body = json.dumps({"from": settings.email_from, "to": [to], "subject": subject, "html": html}).encode("utf-8")
    req = urllib.request.Request(
        _RESEND_ENDPOINT, data=body, method="POST",
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "matrix-builder/1.0 (+https://builder.matrixhub.io)",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return 200 <= resp.status < 300
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = exc.read().decode("utf-8", "replace")[:500]
        except Exception:  # noqa: BLE001
            pass
        logger.error("Resend HTTP send failed: HTTP %s — %s", exc.code, detail)
        return False
    except Exception as exc:  # noqa: BLE001
        logger.error("Resend HTTP send failed: %s", exc)
        return False


def send_email(to: str, subject: str, html: str, settings: Settings | None = None) -> bool:
    """Send one email. Returns True on success (or when logged in dev), False on failure.

    Prefers the official ``resend`` SDK (its User-Agent passes Cloudflare); falls back to a
    direct HTTPS call with a proper User-Agent if the SDK isn't installed.
    """
    settings = settings or get_settings()
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY unset; would email %s — subject=%r", to, subject)
        return True  # dev mode: treat as delivered so local flows don't fail
    via_sdk = _send_via_sdk(to, subject, html, settings)
    return via_sdk if via_sdk is not None else _send_via_http(to, subject, html, settings)


def _shell(title: str, intro: str, cta_label: str, link: str, footer: str) -> str:
    return f"""<!doctype html><html><body style="margin:0;background:#02170f;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#02170f;padding:40px 16px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#06281c;border:1px solid rgba(123,255,184,.16);border-radius:20px;overflow:hidden">
      <tr><td style="padding:36px 36px 6px">
        <div style="display:inline-block;width:40px;height:40px;line-height:40px;text-align:center;border:1px solid rgba(34,200,120,.6);border-radius:10px;color:#53f39d;font-size:20px">&#9671;</div>
        <h1 style="margin:22px 0 8px;color:#f7fff9;font-size:24px;font-weight:600">{title}</h1>
        <p style="margin:0;color:#a7c9b8;font-size:15px;line-height:1.6">{intro}</p>
      </td></tr>
      <tr><td style="padding:24px 36px 8px" align="center">
        <a href="{link}" style="display:inline-block;background:linear-gradient(180deg,#53f39d,#22c878);color:#04140c;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:12px">{cta_label}</a>
      </td></tr>
      <tr><td style="padding:18px 36px 36px">
        <p style="margin:0 0 6px;color:#6f9482;font-size:12px">Or paste this link into your browser:</p>
        <p style="margin:0;word-break:break-all"><a href="{link}" style="color:#53f39d;font-size:12px">{link}</a></p>
        <p style="margin:22px 0 0;color:#6f9482;font-size:12px;line-height:1.6">{footer}</p>
      </td></tr>
    </table>
    <p style="margin:18px 0 0;color:#46604f;font-size:11px">Matrix Builder &middot; Give AI coders a contract, not a prompt.</p>
  </td></tr></table>
</body></html>"""


def activation_email(link: str) -> tuple[str, str]:
    html = _shell(
        "Activate your account",
        "Welcome to <strong style=\"color:#f7fff9\">Matrix Builder</strong>. Confirm your email to activate your account.",
        "Activate account", link,
        "This link expires in 15 minutes. If you didn't create an account, you can ignore this email.",
    )
    return "Activate your Matrix Builder account", html


def reset_email(link: str) -> tuple[str, str]:
    html = _shell(
        "Reset your password",
        "We received a request to reset your <strong style=\"color:#f7fff9\">Matrix Builder</strong> password.",
        "Reset password", link,
        "This link expires in 15 minutes. If you didn't request this, your password is unchanged.",
    )
    return "Reset your Matrix Builder password", html


__all__ = ["build_link", "send_email", "activation_email", "reset_email"]
