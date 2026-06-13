from __future__ import annotations
from typing import Any
from app.core.config import Settings

class SecurityHeadersMiddleware:
    def __init__(self, app: Any, settings: Settings) -> None:
        self.app=app; self.settings=settings
    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get('type')!='http':
            await self.app(scope, receive, send); return
        async def send_wrapper(message: dict[str, Any]) -> None:
            if message.get('type')=='http.response.start':
                headers=message.setdefault('headers', [])
                self._append(headers, 'x-content-type-options', 'nosniff')
                # X-Frame-Options can't allow-list an origin; leave it unset (X_FRAME_OPTIONS="")
                # when the app must be embeddable (e.g. the Hugging Face Space iframe) and rely
                # on the CSP frame-ancestors directive instead.
                if self.settings.x_frame_options:
                    self._append(headers, 'x-frame-options', self.settings.x_frame_options)
                self._append(headers, 'referrer-policy', 'no-referrer')
                self._append(headers, 'permissions-policy', 'camera=(), microphone=(), geolocation=()')
                self._append(headers, 'cross-origin-opener-policy', 'same-origin')
                self._append(headers, 'content-security-policy', self.settings.content_security_policy)
                if self.settings.enable_hsts:
                    self._append(headers, 'strict-transport-security', f'max-age={self.settings.hsts_max_age_seconds}; includeSubDomains')
            await send(message)
        await self.app(scope, receive, send_wrapper)
    @staticmethod
    def _append(headers: list[tuple[bytes, bytes]], name: str, value: str) -> None:
        key=name.encode('latin-1')
        if not any(k.lower()==key for k,_ in headers): headers.append((key, value.encode('latin-1')))
