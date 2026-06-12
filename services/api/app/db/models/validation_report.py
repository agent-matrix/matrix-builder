from __future__ import annotations

from dataclasses import dataclass, field

from app.db.base import Entity


@dataclass
class ValidationReportRecord(Entity):
    bundle_id: str = ""
    status: str = "not-run"
    score: int = 0
    violations: list[dict[str, object]] = field(default_factory=list)
