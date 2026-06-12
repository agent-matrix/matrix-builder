from __future__ import annotations

from app.core.config import get_settings


def guest_bundles_per_day() -> int:
    return get_settings().guest_bundles_per_day


def free_bundles_per_month() -> int:
    return get_settings().free_bundles_per_month
