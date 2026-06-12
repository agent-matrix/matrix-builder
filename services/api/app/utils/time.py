from __future__ import annotations

from datetime import UTC, datetime, timedelta


def utc_now() -> datetime:
    return datetime.now(UTC)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def utc_in(seconds: int) -> datetime:
    return utc_now() + timedelta(seconds=seconds)
