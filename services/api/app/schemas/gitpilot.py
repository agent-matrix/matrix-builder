from __future__ import annotations

from pydantic import Field

from app.schemas.common import StrictModel
from app.schemas.validation import ValidationReport


class GitPilotRunRequest(StrictModel):
    """What the browser sends to start a cloud GitPilot run.

    The signed bundle URL and the A2A secret are added server-side — they are
    never supplied by (or exposed to) the client.
    """

    task_id: str = "TASK-001"
    prompt: str = ""
    project_name: str = ""
    allowed_files: list[str] = Field(default_factory=list)
    forbidden_files: list[str] = Field(default_factory=list)
    validation_commands: list[str] = Field(default_factory=list)
    mode: str = "ask"


class GitPilotRunResponse(StrictModel):
    run_id: str
    status: str = "queued"
    url: str


class GitPilotRunStatusResponse(StrictModel):
    """Result-sync shape surfaced to the UI.

    ``status``/``test_status`` are GitPilot's *implementation* state only. A
    passing run is NOT Matrix approval — Matrix Builder validates separately.
    """

    run_id: str
    status: str
    summary: str = ""
    diff_url: str | None = None
    logs_url: str | None = None
    test_status: str = "not_run"
    changed_files: list[str] = Field(default_factory=list)


class GitPilotCommitGate(StrictModel):
    """Whether a GitPilot run may proceed — derived ONLY from Matrix validation.

    GitPilot can never set these flags; ``can_commit`` is true only when Matrix
    Builder's own validation returns ``approved``. Matrix authority, not GitPilot.
    """

    status: str
    can_commit: bool
    can_repair: bool
    blocked: bool


class GitPilotValidationResult(StrictModel):
    run_id: str
    gate: GitPilotCommitGate
    report: ValidationReport


class GitPilotRepairRequest(StrictModel):
    """Repair dispatch: findings + prompt to re-run inside the contract."""

    validation_findings: list[str] = Field(default_factory=list)
    repair_prompt: str = ""
    allowed_files: list[str] = Field(default_factory=list)
    forbidden_files: list[str] = Field(default_factory=list)


class GitPilotRunRecord(StrictModel):
    """A persisted GitPilot run as shown in history (owner-scoped)."""

    id: str
    bundle_id: str
    task_id: str | None = None
    source: str = "cloud"
    status: str = "queued"
    test_status: str = "not_run"
    summary: str = ""
    changed_files: list[str] = Field(default_factory=list)
    validation_status: str | None = None
    can_commit: bool = False
    parent_run_id: str | None = None
    created_at: str | None = None


class GitPilotRunHistory(StrictModel):
    backend: str
    runs: list[GitPilotRunRecord] = Field(default_factory=list)


class GitPilotPrRequest(StrictModel):
    """Open a PR for an approved run. Repo/title are optional hints."""

    repo_url: str = ""
    title: str = ""
    base: str = "main"


class GitPilotPrResponse(StrictModel):
    run_id: str
    pr_url: str | None = None
    status: str = "draft"
    message: str = ""


class GitPilotMetricsSummary(StrictModel):
    """Owner-scoped observability summary of the GitPilot integration."""

    runs: int = 0
    by_status: dict[str, int] = Field(default_factory=dict)
    by_verdict: dict[str, int] = Field(default_factory=dict)
    committable: int = 0
    history_backend: str = "in-memory"
