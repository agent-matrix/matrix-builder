from __future__ import annotations

from pydantic import Field

from app.schemas.common import ApiRoute, QualityLevel, StrictModel
from app.schemas.idea import IdeaRequest


class BlueprintCandidate(StrictModel):
    candidate_id: str
    title: str
    slug: str
    summary: str
    quality_level: QualityLevel
    stack: list[str] = Field(default_factory=list)
    recommended: bool = False
    estimated_files: int = Field(default=1, ge=1)
    estimated_effort: str = "unknown"
    difficulty: str = "medium"
    standards_profile: str = "standard"
    rationale: str = ""
    generator_actions: list[str] = Field(default_factory=list)
    validation_checks: list[str] = Field(default_factory=list)


class BlueprintCandidateResponse(StrictModel):
    candidates: list[BlueprintCandidate]


class BlueprintGenerationRequest(StrictModel):
    schema_version: str = "matrix.builder.blueprint-generation/v1"
    idea_request: IdeaRequest
    candidate_id: str | None = None


class BlueprintStack(StrictModel):
    frontend: str
    backend: str
    worker: str | None = None
    database: str | None = None
    auth: str = "none"
    deploy: str = "docker"


class BlueprintTask(StrictModel):
    task_id: str = Field(pattern=r"^TASK-[0-9]{3}$")
    title: str
    allowed_files: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)


class BlueprintResult(StrictModel):
    blueprint_id: str
    candidate_id: str
    name: str
    slug: str
    idea: str
    quality_level: QualityLevel
    stack: BlueprintStack
    pages: list[str] = Field(default_factory=list)
    services: list[str] = Field(default_factory=list)
    api_routes: list[ApiRoute] = Field(default_factory=list)
    required_files: list[str] = Field(default_factory=list)
    allowed_change_roots: list[str] = Field(default_factory=list)
    forbidden_changes: list[str] = Field(default_factory=list)
    tasks: list[BlueprintTask] = Field(default_factory=list)
    acceptance_commands: list[str] = Field(default_factory=list)
    standards_lock_ref: str = "MATRIX_STANDARDS.lock"
