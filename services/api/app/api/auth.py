from __future__ import annotations
import re
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel
from sqlalchemy import text
from app.core.auth import current_claims
from app.core.config import get_settings
from app.core.accounts import get_account_store
from app.db import engine as db
from app.core.passwords import hash_password, verify_password
from app.core import account_tokens as tok
from app.core.emailer import activation_email, app_base, build_link, reset_email, send_email
from app.core.google_auth import GoogleAuthError, mint_session_jwt, verify_google_id_token
from app.core.logging import get_logger
from app.core.session import create_guest_session, verify_session_token

logger = get_logger(__name__)
router = APIRouter()
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_GENERIC_SENT = "If that email is valid, we've sent it a message. Check your inbox (and spam)."


# ---- shared shapes -------------------------------------------------------------------------
class AuthUser(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    picture: Optional[str] = None


class SessionResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: int
    user: AuthUser


def _session(account_id: str, email: str | None, name: str | None) -> SessionResponse:
    token, exp = mint_session_jwt(f"account:{account_id}", email=email, name=name)
    return SessionResponse(access_token=token, expires_at=exp, user=AuthUser(email=email, name=name))


def _valid_email(email: str) -> str:
    e = email.strip().lower()
    if not _EMAIL_RE.match(e):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a valid email address.")
    return e


def _deliver(to: str, subject: str, html: str, link: str) -> bool:
    """Best-effort send. Never blocks the flow: on failure we log the link server-side so the
    account isn't a dead-end (the operator can recover it / the user can retry)."""
    ok = send_email(to, subject, html, get_settings())
    if not ok:
        logger.warning("email delivery failed for %s — recovery link (server log only): %s", to, link)
    return ok


# ---- status --------------------------------------------------------------------------------
@router.get('/auth/status')
def auth_status() -> dict[str, object]:
    settings = get_settings()
    return {'status': 'ready', 'message': 'Email/password + Google sign-in are enabled.',
            'google_enabled': bool(settings.google_client_id), 'google_client_id': settings.google_client_id,
            'email_enabled': bool(settings.resend_api_key)}


# ---- traditional email + password ----------------------------------------------------------
class SignupRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    origin: Optional[str] = None


@router.post('/auth/signup', status_code=status.HTTP_202_ACCEPTED)
def signup(payload: SignupRequest) -> dict[str, object]:
    settings = get_settings()
    email = _valid_email(payload.email)
    try:
        pw_hash = hash_password(payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    store = get_account_store()
    existing = store.get_by_email(email)
    if existing and existing.is_active:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists. Please sign in.")
    if not existing:
        store.create(email, pw_hash, name=payload.name, is_active=False, provider="password")
    # If the account exists but is still inactive, we simply re-send the activation email below.
    base = app_base(payload.origin, settings)
    link = build_link("/auth/activate", tok.make_token(email, tok.ACTIVATE, settings), base)
    subject, html = activation_email(link)
    delivered = _deliver(email, subject, html, link)
    return {"status": "pending_activation",
            "email_sent": delivered,
            "message": "Check your inbox to activate your account."
                       if delivered else "Account created. Activation email is delayed — try again shortly or contact support."}


class TokenRequest(BaseModel):
    token: str


@router.post('/auth/activate', response_model=SessionResponse)
def activate(payload: TokenRequest) -> SessionResponse:
    try:
        email = tok.verify_token(payload.token, tok.ACTIVATE)
    except tok.AccountTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    store = get_account_store()
    acc = store.get_by_email(email)
    if not acc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")
    store.set_active(email, True)
    return _session(acc.id, acc.email, acc.name)


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post('/auth/login', response_model=SessionResponse)
def login(payload: LoginRequest) -> SessionResponse:
    email = _valid_email(payload.email)
    acc = get_account_store().get_by_email(email)
    if not acc or not verify_password(payload.password, acc.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect email or password.")
    if not acc.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Activate your account from the email we sent before signing in.")
    return _session(acc.id, acc.email, acc.name)


class EmailOnlyRequest(BaseModel):
    email: str
    origin: Optional[str] = None


@router.post('/auth/password/forgot')
def password_forgot(payload: EmailOnlyRequest) -> dict[str, object]:
    settings = get_settings()
    email = _valid_email(payload.email)
    acc = get_account_store().get_by_email(email)
    # Don't reveal whether the account exists; only actually send when it does.
    if acc and acc.provider == "password":
        base = app_base(payload.origin, settings)
        link = build_link("/auth/reset", tok.make_token(email, tok.RESET, settings), base)
        subject, html = reset_email(link)
        _deliver(email, subject, html, link)
    return {"sent": True, "message": _GENERIC_SENT}


class ResetRequest(BaseModel):
    token: str
    password: str


@router.post('/auth/password/reset', response_model=SessionResponse)
def password_reset(payload: ResetRequest) -> SessionResponse:
    try:
        email = tok.verify_token(payload.token, tok.RESET)
    except tok.AccountTokenError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    try:
        pw_hash = hash_password(payload.password)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    store = get_account_store()
    acc = store.get_by_email(email)
    if not acc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Account not found.")
    store.set_password(email, pw_hash)  # also re-activates
    return _session(acc.id, acc.email, acc.name)


# ---- Google (id-token) ---------------------------------------------------------------------
class GoogleAuthRequest(BaseModel):
    credential: str


@router.post('/auth/google', response_model=SessionResponse)
def google_login(payload: GoogleAuthRequest) -> SessionResponse:
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google sign-in is not configured.")
    try:
        claims = verify_google_id_token(payload.credential, settings.google_client_id)
    except GoogleAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    email = str(claims.get("email", "")).lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token has no email.")
    store = get_account_store()
    acc = store.get_by_email(email)
    if not acc:
        acc = store.create(email, None, name=claims.get("name"), is_active=True, provider="google")
    elif not acc.is_active:
        store.set_active(email, True)  # Google verifies the email, so activate
    token, exp = mint_session_jwt(f"account:{acc.id}", email=email, name=claims.get("name"))
    return SessionResponse(access_token=token, expires_at=exp,
                           user=AuthUser(email=email, name=claims.get("name"), picture=claims.get("picture")))


# ---- update account profile ----------------------------------------------------------------
class UpdateAccountRequest(BaseModel):
    name: Optional[str] = None


@router.patch('/auth/account', response_model=AuthUser)
def update_account(payload: UpdateAccountRequest, claims: dict = Depends(current_claims)) -> AuthUser:
    email = claims.get("email")
    name = (payload.name or "").strip() or None
    if email:
        get_account_store().set_name(str(email), name)
    return AuthUser(email=email, name=name)


# ---- delete account (GDPR: remove account + all owned data) --------------------------------
@router.delete('/auth/account')
def delete_account(claims: dict = Depends(current_claims)) -> dict[str, object]:
    sub = str(claims.get("sub", ""))
    email = claims.get("email")
    # 1) Remove the credential/PII row.
    if email:
        get_account_store().delete_by_email(str(email))
    # 2) Remove all workflow data owned by this user — deleting the users row cascades the whole
    #    graph (projects → versions → batches → commits → runs → events → findings → artifacts).
    if db.is_configured() and sub:
        try:
            with db.session_scope(user_id=sub) as s:
                s.execute(text("DELETE FROM users WHERE id = :sub"), {"sub": sub})
        except Exception as exc:  # noqa: BLE001 — best effort; account PII is already gone
            logger.warning("workflow data delete skipped for %s: %s", sub, exc)
    return {"deleted": True, "message": "Your account and data have been deleted."}


# ---- guest session (unchanged) -------------------------------------------------------------
class GuestSessionResponse(BaseModel):
    session_id: str
    plan: str
    expires_at: int
    access_token: str


@router.post('/auth/session', response_model=GuestSessionResponse)
def create_session(response: Response) -> GuestSessionResponse:
    settings = get_settings()
    claims, token = create_guest_session(settings)
    response.set_cookie(settings.session_cookie_name, token, httponly=True, secure=settings.production,
                        samesite='lax', max_age=settings.session_ttl_seconds)
    return GuestSessionResponse(session_id=claims.session_id, plan=claims.plan, expires_at=claims.expires_at, access_token=token)


@router.post('/auth/session/verify')
def verify_session(payload: dict[str, str]) -> dict[str, object]:
    claims = verify_session_token(payload.get('access_token', ''), get_settings())
    return {'valid': False} if claims is None else {'valid': True, 'claims': claims.to_dict()}
