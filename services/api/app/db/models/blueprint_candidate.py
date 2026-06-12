from __future__ import annotations

from dataclasses import dataclass, field

from app.db.base import Entity


@dataclass
class BlueprintCandidateRecord(Entity):
    idea_request_id: str = ""
    title: str = ""
    slug: str = ""
    quality_level: str = "standard"
    recommended: bool = False
    payload: dict[str, object] = field(default_factory=dict)
