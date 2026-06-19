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


# --- Matrix Designer: Blueprint Details (the dashboard the Details page renders) -------
# Lenient models (ignore extra keys) so designer output maps cleanly even as it evolves.
from pydantic import BaseModel  # noqa: E402


class DesignerArchitectureNode(BaseModel):
    name: str
    description: str = ""
    dependencies: list[str] = Field(default_factory=list)


class DesignerFilePlanItem(BaseModel):
    path: str
    description: str = ""


class DesignerBatch(BaseModel):
    id: str
    name: str
    purpose: str = ""
    tasks: list[str] = Field(default_factory=list)
    allowed_files: list[str] = Field(default_factory=list)
    depends_on: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    validation_checks: list[str] = Field(default_factory=list)
    must_not_change: list[str] = Field(default_factory=list)


class DesignerChatMessage(BaseModel):
    id: str = ""
    role: str = "blueprint"
    content: str = ""
    timestamp: str = ""


class BlueprintDetails(BaseModel):
    candidate_id: str
    overview: str = ""
    architecture: list[DesignerArchitectureNode] = Field(default_factory=list)
    batches: list[DesignerBatch] = Field(default_factory=list)
    file_plan: list[DesignerFilePlanItem] = Field(default_factory=list)
    matrix_rules: list[str] = Field(default_factory=list)
    acceptance_criteria: list[str] = Field(default_factory=list)
    validation_plan: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)
    design_brain: str | None = None
    chat_history: list[DesignerChatMessage] = Field(default_factory=list)


class BlueprintChatRequest(BaseModel):
    message: str
    idea: str | None = None


class BlueprintChatResponse(BaseModel):
    reply: str
    details: BlueprintDetails


class BlueprintSaveRequest(BaseModel):
    idea: str | None = None
    build_id: str | None = None
    details: BlueprintDetails


class BlueprintSavedResponse(BaseModel):
    found: bool = False
    idea: str = ""
    details: BlueprintDetails | None = None


class DesignerCandidate(BaseModel):
    id: str
    tier: str
    title: str
    summary: str = ""
    file_count: int = 1
    difficulty: str = "Medium"
    estimate: str = "unknown"
    stack: list[str] = Field(default_factory=list)
    recommended: bool = False


class DesignerCandidatesResponse(BaseModel):
    candidates: list[DesignerCandidate] = Field(default_factory=list)
