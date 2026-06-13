from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, HTTPException, Response, status
from pydantic import BaseModel
from app.core.config import get_settings
from app.core.google_auth import GoogleAuthError, mint_session_jwt, verify_google_id_token
from app.core.email_auth import EmailAuthError, build_magic_link, make_magic_token, send_magic_link, verify_magic_token
from app.core.session import create_guest_session, verify_session_token
import re
router=APIRouter()
_EMAIL_RE=re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
class SessionResponse(BaseModel):
    session_id: str; plan: str; expires_at: int; access_token: str
class GoogleAuthRequest(BaseModel):
    credential: str
class AuthUser(BaseModel):
    email: Optional[str] = None; name: Optional[str] = None; picture: Optional[str] = None
class GoogleAuthResponse(BaseModel):
    access_token: str; token_type: str = "bearer"; expires_at: int; user: AuthUser
@router.get('/auth/status')
def auth_status() -> dict[str, object]:
    settings=get_settings()
    # google_client_id is a PUBLIC OAuth identifier (safe to expose) so the SPA can enable
    # Sign in with Google from a single backend env var — no frontend rebuild required.
    return {'status':'ready','message':'Guest sessions and signed session tokens are enabled.','google_enabled': bool(settings.google_client_id),'google_client_id': settings.google_client_id,'email_enabled': bool(settings.resend_api_key)}
@router.post('/auth/google', response_model=GoogleAuthResponse)
def google_login(payload: GoogleAuthRequest) -> GoogleAuthResponse:
    settings=get_settings()
    if not settings.google_client_id:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Google sign-in is not configured.")
    try:
        claims=verify_google_id_token(payload.credential, settings.google_client_id)
    except GoogleAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    # Namespace the subject so Google users never collide with guest/CLI ids; this is the RLS owner.
    sub=f"google:{claims['sub']}"
    token, exp=mint_session_jwt(sub, email=claims.get('email'), name=claims.get('name'), settings=settings)
    return GoogleAuthResponse(access_token=token, expires_at=exp, user=AuthUser(email=claims.get('email'), name=claims.get('name'), picture=claims.get('picture')))
class EmailRequest(BaseModel):
    email: str
class EmailRequestResponse(BaseModel):
    sent: bool; message: str
class EmailVerifyRequest(BaseModel):
    token: str
@router.post('/auth/email/request', response_model=EmailRequestResponse)
def email_request(payload: EmailRequest) -> EmailRequestResponse:
    settings=get_settings()
    email=payload.email.strip().lower()
    # Always reply the same way (don't reveal whether an email exists / is deliverable).
    generic="If that email is valid, a sign-in link is on its way. Check your inbox."
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a valid email address.")
    link=build_magic_link(make_magic_token(email, settings), settings)
    send_magic_link(email, link, settings)
    return EmailRequestResponse(sent=True, message=generic)
@router.post('/auth/email/verify', response_model=GoogleAuthResponse)
def email_verify(payload: EmailVerifyRequest) -> GoogleAuthResponse:
    settings=get_settings()
    try:
        email=verify_magic_token(payload.token, settings)
    except EmailAuthError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    token, exp=mint_session_jwt(f"email:{email}", email=email, settings=settings)
    return GoogleAuthResponse(access_token=token, expires_at=exp, user=AuthUser(email=email))
@router.post('/auth/session', response_model=SessionResponse)
def create_session(response: Response) -> SessionResponse:
    settings=get_settings(); claims, token=create_guest_session(settings); response.set_cookie(settings.session_cookie_name, token, httponly=True, secure=settings.production, samesite='lax', max_age=settings.session_ttl_seconds); return SessionResponse(session_id=claims.session_id, plan=claims.plan, expires_at=claims.expires_at, access_token=token)
@router.post('/auth/session/verify')
def verify_session(payload: dict[str, str]) -> dict[str, object]:
    claims=verify_session_token(payload.get('access_token',''), get_settings())
    return {'valid': False} if claims is None else {'valid': True, 'claims': claims.to_dict()}
