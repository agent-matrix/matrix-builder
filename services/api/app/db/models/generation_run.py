from __future__ import annotations

from dataclasses import dataclass, field

from app.db.base import Entity


@dataclass
class GenerationRunRecord(Entity):
    idea_request_id: str = ""
    blueprint_id: str | None = None
    bundle_id: str | None = None
    status: str = "queued"
    trace_id: str | None = None
    payload: dict[str, object] = field(default_factory=dict)
