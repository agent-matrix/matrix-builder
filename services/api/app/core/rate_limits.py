from __future__ import annotations
import time
from dataclasses import dataclass, field
from typing import Any
from starlette.responses import JSONResponse
from app.core.config import Settings

def rate_limit_key(user_id: str | None, ip: str) -> str: return user_id or ip
@dataclass
class Bucket: tokens: float; updated_at: float = field(default_factory=time.time)
class InMemoryTokenBucket:
    def __init__(self, requests_per_minute: int, burst: int) -> None:
        self.rate_per_second=max(requests_per_minute,1)/60.0; self.capacity=max(burst,1); self._buckets: dict[str, Bucket]={}
    def allow(self, key: str, cost: int=1) -> bool:
        now=time.time(); bucket=self._buckets.get(key)
        if bucket is None: bucket=Bucket(float(self.capacity), now); self._buckets[key]=bucket
        bucket.tokens=min(float(self.capacity), bucket.tokens + max(now-bucket.updated_at,0.0)*self.rate_per_second); bucket.updated_at=now
        if bucket.tokens>=cost: bucket.tokens-=cost; return True
        return False
class RateLimitMiddleware:
    def __init__(self, app: Any, settings: Settings) -> None:
        self.app=app; self.settings=settings; self.bucket=InMemoryTokenBucket(settings.rate_limit_requests_per_minute, settings.rate_limit_burst)
    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if not self.settings.rate_limit_enabled or scope.get('type')!='http': await self.app(scope, receive, send); return
        client=scope.get('client') or ('unknown',0); ip=client[0] if isinstance(client, tuple) else 'unknown'; headers=dict(scope.get('headers', [])); user=headers.get(b'x-matrix-user-id', b'').decode('latin-1') or None
        if not self.bucket.allow(rate_limit_key(user, str(ip))):
            response=JSONResponse(status_code=429, content={'detail':'Rate limit exceeded','code':'rate_limit_exceeded'}, headers={'Retry-After':'60'}); await response(scope, receive, send); return
        await self.app(scope, receive, send)
