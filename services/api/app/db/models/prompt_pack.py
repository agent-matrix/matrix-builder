from __future__ import annotations

from dataclasses import dataclass, field

from app.db.base import Entity


@dataclass
class PromptPackRecord(Entity):
    bundle_id: str = ""
    default_coder: str = "generic-ai-coder"
    prompt_paths: list[str] = field(default_factory=list)
