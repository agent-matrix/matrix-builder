from __future__ import annotations
import base64, hashlib, hmac, json, time
from dataclasses import dataclass
from uuid import uuid4
from app.core.config import Settings
@dataclass(frozen=True)
class SessionClaims:
    session_id: str; plan: str; subject: str | None; issued_at: int; expires_at: int
    def to_dict(self) -> dict[str, object]: return {'session_id':self.session_id,'plan':self.plan,'subject':self.subject,'issued_at':self.issued_at,'expires_at':self.expires_at}
def _b64(data: bytes) -> str: return base64.urlsafe_b64encode(data).decode('ascii').rstrip('=')
def _unb64(data: str) -> bytes: return base64.urlsafe_b64decode((data + '=' * (-len(data)%4)).encode('ascii'))
def sign_claims(claims: SessionClaims, settings: Settings) -> str:
    payload=_b64(json.dumps(claims.to_dict(), separators=(',',':'), sort_keys=True).encode()); sig=hmac.new(settings.session_signing_key.encode(), payload.encode(), hashlib.sha256).digest(); return f'{payload}.{_b64(sig)}'
def verify_session_token(token: str, settings: Settings) -> SessionClaims | None:
    try:
        payload,sig=token.split('.',1); expected=hmac.new(settings.session_signing_key.encode(), payload.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(_b64(expected), sig): return None
        raw=json.loads(_unb64(payload).decode('utf-8')); exp=int(raw['expires_at'])
        if exp < int(time.time()): return None
        return SessionClaims(str(raw['session_id']), str(raw.get('plan','guest')), raw.get('subject'), int(raw['issued_at']), exp)
    except Exception: return None
def create_guest_session(settings: Settings) -> tuple[SessionClaims, str]:
    now=int(time.time()); claims=SessionClaims(f'ses_{uuid4().hex[:18]}','guest',None,now,now+settings.session_ttl_seconds); return claims, sign_claims(claims, settings)
