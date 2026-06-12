from __future__ import annotations

from dataclasses import dataclass, field

from app.db.base import Entity


@dataclass
class BlueprintRecord(Entity):
    candidate_id: str = ""
    name: str = ""
    slug: str = ""
    standards_lock_ref: str = "MATRIX_STANDARDS.lock"
    payload: dict[str, object] = field(default_factory=dict)
