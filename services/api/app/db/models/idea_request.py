from __future__ import annotations

from dataclasses import dataclass

from app.db.base import Entity


@dataclass
class IdeaRequestRecord(Entity):
    idea: str = ""
    build_type: str = "app"
    goal: str = "startup-mvp"
    preferred_coder: str = "generic-ai-coder"
    quality_level: str = "standard"
    user_id: str | None = None
