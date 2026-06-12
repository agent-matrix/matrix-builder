from __future__ import annotations

from datetime import timedelta

from app.core.config import get_settings
from app.utils.time import utc_now

DEFAULT_GUEST_BUNDLE_TTL_SECONDS = 172800
FREE_BUNDLES_PER_MONTH = 20


def guest_bundle_expires_at():
    return utc_now() + timedelta(seconds=get_settings().guest_bundle_ttl_seconds)


def free_bundle_expires_at():
    return utc_now() + timedelta(seconds=get_settings().free_bundle_ttl_seconds)


def ttl_seconds_for_persisted(persisted: bool) -> int:
    settings = get_settings()
    return settings.free_bundle_ttl_seconds if persisted else settings.guest_bundle_ttl_seconds
