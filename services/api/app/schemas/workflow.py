"""Pydantic schemas for the /v1 Continuous Build workflow API (Batch C2).

Wire vocabularies are hyphenated and stored verbatim (``approved``/``needs-repair``/``rejected``
/``not-run``). The UI copy ("Passed" / "Needs repair" / "Rejected") is derived in the response
via ``ui_label`` so the engine's status is never re-spelled on the way through.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import Field

from app.schemas.common import CoderId, StrictModel

# --- status vocabulary ---------------------------------------------------------------------


class BatchChangeType(StrEnum):
    SMALL_UPDATE = "small-update"
    ADD_FEATURE = "add-feature"
    FIX_ISSUE = "fix-issue"


_UI_LABELS = {
    "approved": "Passed",
    "needs-repair": "Needs repair",
    "rejected": "Rejected",
    "not-run": "Not run",
    "running": "Running",
}


def ui_label(status: str) -> str:
    return _UI_LABELS.get(status, status)


# --- projects ------------------------------------------------------------------------------


class ProjectCreate(StrictModel):
    title: str = Field(min_length=1)
    slug: str = Field(min_length=1, max_length=120)
    description: str = ""


class ProjectResponse(StrictModel):
    id: str
    owner_id: str
    title: str
    slug: str
    description: str
    status: str
    privacy: str
    created_at: datetime


# --- versions ------------------------------------------------------------------------------


class VersionCreate(StrictModel):
    project_id: str
    version_label: str = Field(default="v1.0.0", max_length=32)
    title: str = Field(min_length=1)
    requirements_md: str = ""
    parent_version_id: str | None = None


class VersionResponse(StrictModel):
    id: str
    project_id: str
    parent_version_id: str | None
    version_label: str
    title: str
    requirements_md: str
    status: str
    created_at: datetime


# --- batches -------------------------------------------------------------------------------


class BatchCreate(StrictModel):
    version_id: str
    title: str = ""
    goal_md: str = Field(min_length=1)
    change_type: BatchChangeType = BatchChangeType.ADD_FEATURE


class BatchResponse(StrictModel):
    id: str
    version_id: str
    ordinal: int
    title: str
    goal_md: str
    change_type: str
    status: str
    parent_commit_id: str | None
    created_at: datetime


class PromptPackRequest(StrictModel):
    coder: CoderId = CoderId.GENERIC_AI_CODER


class PromptPackResponse(StrictModel):
    batch_id: str
    prompt_version_id: str
    coder: str
    prompt_text: str
    constraints: dict
    batch_status: str


# --- executions / validation ---------------------------------------------------------------


class ChangedFile(StrictModel):
    path: str = Field(min_length=1)
    change_type: str = "modified"  # added|modified|deleted


class DependencyChange(StrictModel):
    name: str
    version: str | None = None
    action: str = "add"  # add|remove|update


class ExecutionRequest(StrictModel):
    coder: CoderId = CoderId.GENERIC_AI_CODER
    changed_files: list[ChangedFile] = Field(default_factory=list)
    dependency_changes: list[DependencyChange] = Field(default_factory=list)
    patch: str | None = None
    summary: str = ""


class ValidationFindingResponse(StrictModel):
    id: str
    severity: str
    status: str
    check_name: str
    file_path: str | None
    message: str
    remediation: str | None


class ValidationRunResponse(StrictModel):
    id: str
    commit_id: str
    status: str
    ui_label: str
    score: int | None
    runner: str
    findings: list[ValidationFindingResponse] = Field(default_factory=list)


class CommitResponse(StrictModel):
    id: str
    version_id: str
    batch_id: str
    commit_no: int
    summary: str
    tree_hash: str
    validation_status: str
    ui_label: str
    parent_commit_id: str | None
    created_at: datetime


class ExecutionResponse(StrictModel):
    """Result of submitting a batch's changes: the commit + its validation outcome."""

    commit: CommitResponse
    validation_run: ValidationRunResponse
    outcome: str  # committed|needs-repair|rejected
    next_action: str


class CommitDiffResponse(StrictModel):
    base_commit_id: str | None
    head_commit_id: str
    patch: str


class ArtifactResponse(StrictModel):
    id: str
    artifact_type: str
    storage_key: str
    sha256: str
    size_bytes: int


# --- async runs + events (Batch C3) --------------------------------------------------------


class RunEnqueueResponse(StrictModel):
    run_id: str
    status: str
    ui_label: str
    events_url: str
    ws_url: str


class RunResponse(StrictModel):
    id: str
    batch_id: str | None
    commit_id: str | None
    status: str
    ui_label: str
    score: int | None
    runner: str


class RunEventResponse(StrictModel):
    seq: int
    run_id: str
    event_type: str
    payload: dict
    created_at: datetime | None = None


# --- repair batches ------------------------------------------------------------------------


class RepairBatchRequest(StrictModel):
    validation_run_id: str
    coder: CoderId = CoderId.GENERIC_AI_CODER


# --- timeline ------------------------------------------------------------------------------


class TimelineEntry(StrictModel):
    kind: str  # batch|commit
    id: str
    ordinal: int | None = None
    commit_no: int | None = None
    title: str = ""
    status: str = ""
    ui_label: str | None = None
    created_at: datetime


class TimelineResponse(StrictModel):
    version_id: str
    version_label: str
    entries: list[TimelineEntry]


# --- sync (Track L2: mb sync ↔ /v1) --------------------------------------------------------
# The local .mb/ store and the server tables share shapes and an id space (content-addressed
# ids fit String(36)), so sync is upsert-by-id.


class SyncProject(StrictModel):
    id: str
    slug: str
    title: str = ""
    description: str = ""


class SyncVersion(StrictModel):
    id: str
    project_id: str
    version_label: str = "v1.0.0"
    title: str = ""
    requirements_md: str = ""


class SyncBatch(StrictModel):
    id: str
    version_id: str
    ordinal: int = Field(ge=1)
    title: str = ""
    goal_md: str = ""
    change_type: str = "add-feature"
    status: str = "draft"
    parent_commit_id: str | None = None


class SyncCommit(StrictModel):
    id: str
    batch_id: str
    version_id: str
    commit_no: int = Field(ge=1)
    summary: str = ""
    tree_hash: str
    validation_status: str = "not-run"
    parent_commit_id: str | None = None
    manifest: dict = Field(default_factory=dict)


class SyncRequest(StrictModel):
    project: SyncProject
    version: SyncVersion
    batches: list[SyncBatch] = Field(default_factory=list)
    commits: list[SyncCommit] = Field(default_factory=list)


class SyncResponse(StrictModel):
    project_id: str
    version_id: str
    applied: dict
    timeline: TimelineResponse

