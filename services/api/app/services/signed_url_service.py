from __future__ import annotations

import base64
import hashlib
import hmac
from dataclasses import dataclass
from datetime import timedelta

from app.core.config import get_settings
from app.utils.time import utc_now


def default_signed_url_ttl() -> int:
    return get_settings().signed_url_ttl_seconds


@dataclass
class SignedUrl:
    url: str
    expires_at: object
    expires_in_seconds: int


class SignedUrlService:
    def __init__(self, base_url: str | None = None, secret: str | None = None) -> None:
        settings = get_settings()
        self.base_url = (base_url or settings.public_api_base_url).rstrip("/")
        self.secret = (secret or settings.signed_url_secret).encode("utf-8")

    def sign_download_url(self, bundle_id: str, ttl_seconds: int | None = None) -> SignedUrl:
        ttl = ttl_seconds or default_signed_url_ttl()
        expires_at = utc_now() + timedelta(seconds=ttl)
        expires_ts = int(expires_at.timestamp())
        token = self._token(bundle_id, expires_ts)
        url = f"{self.base_url}/bundles/{bundle_id}/download?expires={expires_ts}&token={token}"
        return SignedUrl(url=url, expires_at=expires_at, expires_in_seconds=ttl)

    def verify_download_token(self, bundle_id: str, expires: int, token: str) -> bool:
        if utc_now().timestamp() > expires:
            return False
        expected = self._token(bundle_id, expires)
        return hmac.compare_digest(expected, token)

    def _token(self, bundle_id: str, expires: int) -> str:
        message = f"{bundle_id}:{expires}".encode("utf-8")
        digest = hmac.new(self.secret, message, hashlib.sha256).digest()
        return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
