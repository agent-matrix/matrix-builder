from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime

from app.core.config import get_settings
from app.schemas.bundle import QuotaStatus


def guest_limit() -> int:
    return get_settings().guest_bundles_per_day


@dataclass
class QuotaDecision:
    allowed: bool
    status: QuotaStatus


class QuotaService:
    """In-memory quota tracker for local/dev mode.

    Production can replace this with a database-backed implementation without changing
    the Matrix Builder API contract.
    """

    def __init__(self) -> None:
        self._daily: dict[tuple[str, str], int] = defaultdict(int)
        self._monthly: dict[tuple[str, str], int] = defaultdict(int)

    def check_guest(self, actor: str = "guest") -> QuotaDecision:
        settings = get_settings()
        key = (actor, datetime.now(UTC).strftime("%Y-%m-%d"))
        used = self._daily[key]
        remaining = max(settings.guest_bundles_per_day - used, 0)
        status = QuotaStatus(
            actor=actor,
            period="day",
            limit=settings.guest_bundles_per_day,
            used=used,
            remaining=remaining,
        )
        return QuotaDecision(allowed=remaining > 0, status=status)

    def consume_guest(self, actor: str = "guest") -> QuotaStatus:
        decision = self.check_guest(actor)
        if decision.allowed:
            key = (actor, datetime.now(UTC).strftime("%Y-%m-%d"))
            self._daily[key] += 1
        return self.check_guest(actor).status

    def check_free(self, actor: str) -> QuotaDecision:
        settings = get_settings()
        key = (actor, datetime.now(UTC).strftime("%Y-%m"))
        used = self._monthly[key]
        remaining = max(settings.free_bundles_per_month - used, 0)
        status = QuotaStatus(
            actor=actor,
            period="month",
            limit=settings.free_bundles_per_month,
            used=used,
            remaining=remaining,
        )
        return QuotaDecision(allowed=remaining > 0, status=status)

    def consume_free(self, actor: str) -> QuotaStatus:
        decision = self.check_free(actor)
        if decision.allowed:
            key = (actor, datetime.now(UTC).strftime("%Y-%m"))
            self._monthly[key] += 1
        return self.check_free(actor).status
