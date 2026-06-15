"""ProjectBrief — the unifying structured object for imported sources (Path B).

A brief is produced deterministically from extracted document text (and may later be improved by
OllaBridge for logged-in users). It never bypasses the deterministic engine: it is folded back into
an IdeaRequest (see brief_to_idea) so the existing candidate generation stays the sole authority.
"""
from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.schemas.common import StrictModel

BriefSource = Literal["idea", "document", "design", "template"]


class ProjectBrief(StrictModel):
    schema_version: str = "matrix.builder.brief/v1"
    source_type: BriefSource = "document"
    title: str
    summary: str
    domain: str | None = None
    goals: list[str] = Field(default_factory=list)
    users: list[str] = Field(default_factory=list)
    features: list[str] = Field(default_factory=list)
    screens: list[str] = Field(default_factory=list)
    integrations: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    non_functional: list[str] = Field(default_factory=list)
    source_files: list[str] = Field(default_factory=list)
    enhanced_by: Literal["deterministic", "ollabridge"] = "deterministic"


class IngestDocumentResponse(StrictModel):
    source_type: str
    filename: str
    markdown: str
    brief: ProjectBrief
    # The brief folded into a single idea string the existing engine can parse (Path B → same flow).
    idea: str
