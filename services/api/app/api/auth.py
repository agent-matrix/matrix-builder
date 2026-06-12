from __future__ import annotations
from fastapi import APIRouter, Response
from pydantic import BaseModel
from app.core.config import get_settings
from app.core.session import create_guest_session, verify_session_token
router=APIRouter()
class SessionResponse(BaseModel):
    session_id: str; plan: str; expires_at: int; access_token: str
@router.get('/auth/status')
def auth_status() -> dict[str, str]: return {'status':'ready','message':'Guest sessions and signed session tokens are enabled.'}
@router.post('/auth/session', response_model=SessionResponse)
def create_session(response: Response) -> SessionResponse:
    settings=get_settings(); claims, token=create_guest_session(settings); response.set_cookie(settings.session_cookie_name, token, httponly=True, secure=settings.production, samesite='lax', max_age=settings.session_ttl_seconds); return SessionResponse(session_id=claims.session_id, plan=claims.plan, expires_at=claims.expires_at, access_token=token)
@router.post('/auth/session/verify')
def verify_session(payload: dict[str, str]) -> dict[str, object]:
    claims=verify_session_token(payload.get('access_token',''), get_settings())
    return {'valid': False} if claims is None else {'valid': True, 'claims': claims.to_dict()}
