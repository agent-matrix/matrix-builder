from __future__ import annotations
from contextvars import ContextVar
from typing import Any
from uuid import uuid4
request_id_ctx: ContextVar[str]=ContextVar('matrix_builder_request_id', default='')
class RequestIdMiddleware:
    def __init__(self, app: Any) -> None: self.app=app
    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get('type')!='http': await self.app(scope, receive, send); return
        headers=dict(scope.get('headers', [])); incoming=headers.get(b'x-request-id', b'').decode('latin-1')
        rid=incoming or f'req_{uuid4().hex[:16]}'; token=request_id_ctx.set(rid)
        async def send_wrapper(message: dict[str, Any]) -> None:
            if message.get('type')=='http.response.start': message.setdefault('headers', []).append((b'x-request-id', rid.encode('latin-1')))
            await send(message)
        try: await self.app(scope, receive, send_wrapper)
        finally: request_id_ctx.reset(token)
def current_request_id() -> str: return request_id_ctx.get()
