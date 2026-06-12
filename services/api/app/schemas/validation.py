from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import JsonDict, StrictModel, ValidationStatus

Severity = Literal["info", "low", "medium", "high", "critical"]
CheckStatus = Literal["passed", "failed", "skipped"]
FileChangeStatus = Literal["added", "modified", "deleted", "renamed"]
DependencyChangeAction = Literal["added", "updated", "removed"]
ValidationMode = Literal["bundle", "patch", "repository", "dry-run"]


class ChangedFile(StrictModel):
    path: str = Field(min_length=1)
    status: FileChangeStatus = "modified"
    digest: str | None = None
    previous_path: str | None = None


class DependencyChange(StrictModel):
    ecosystem: str = Field(min_length=1)
    name: str = Field(min_length=1)
    action: DependencyChangeAction = "added"
    version: str | None = None
    approved: bool = False
    reason: str | None = None


class ValidationArtifact(StrictModel):
    kind: str = Field(min_length=1)
    path: str = Field(min_length=1)
    digest: str | None = None
    verified: bool = False


class ValidationRequest(StrictModel):
    """A generated repo or patch submitted for Matrix contract validation.

    This accepts references instead of raw archives so the API can support browser uploads,
    object-storage uploads, GitHub PR refs, or local dev fixtures without changing the contract.
    """

    schema_version: str = "matrix.builder.validation-request/v1"
    bundle_id: str | None = None
    mode: ValidationMode = "patch"
    changed_files: list[ChangedFile] = Field(default_factory=list)
    dependency_changes: list[DependencyChange] = Field(default_factory=list)
    artifacts: list[ValidationArtifact] = Field(default_factory=list)
    standards_lock_digest: str | None = None
    matrix_blueprint_digest: str | None = None
    repository_archive_ref: str | None = None
    patch_ref: str | None = None
    metadata: JsonDict = Field(default_factory=dict)


class ValidationViolation(StrictModel):
    rule_id: str
    severity: Severity
    message: str
    path: str | None = None
    remediation: str | None = None


class ValidationCheck(StrictModel):
    check_id: str
    status: CheckStatus
    message: str | None = None


class ValidationReport(StrictModel):
    report_id: str = "validation_not_run"
    bundle_id: str = "bundle_demo"
    status: ValidationStatus = ValidationStatus.NOT_RUN
    score: int = Field(ge=0, le=100)
    violations: list[ValidationViolation] = Field(default_factory=list)
    repair_prompt: str | None = None
    checks: list[ValidationCheck] = Field(default_factory=list)
    approved: bool = False
    matrixhub_publishable: bool = False
    summary: str | None = None
    created_at: datetime | None = None
