from __future__ import annotations

from datetime import datetime

from pydantic import Field

from app.schemas.common import BundleFile, BundleStatus, CoderId, JsonDict, StrictModel, ValidationStatus
from app.schemas.idea import IdeaRequest


class BundleGenerationRequest(StrictModel):
    schema_version: str = "matrix.builder.bundle-generation/v1"
    idea_request: IdeaRequest
    candidate_id: str | None = None
    preferred_coder: CoderId = CoderId.GENERIC_AI_CODER
    persist: bool = False
    account_id: str | None = None


class BundleManifest(StrictModel):
    schema_version: str = "matrix.builder.bundle-manifest/v1"
    bundle_id: str
    blueprint_id: str
    title: str
    created_at: datetime
    expires_at: datetime | None = None
    status: BundleStatus = BundleStatus.READY
    manifest_digest: str
    zip_digest: str
    zip_size_bytes: int = Field(ge=0)
    file_count: int = Field(ge=1)
    files: list[BundleFile]
    prompts_available: list[CoderId]
    standards: list[str] = Field(default_factory=list)
    storage_uri: str
    checksums: dict[str, str] = Field(default_factory=dict)
    metadata: JsonDict = Field(default_factory=dict)


class BundleTreeNode(StrictModel):
    path: str
    kind: str
    required: bool = True
    size_bytes: int | None = Field(default=None, ge=0)
    digest: str | None = None


class SignedBundleUrlResponse(StrictModel):
    bundle_id: str
    url: str
    expires_at: datetime
    expires_in_seconds: int = Field(ge=0)


class BundleSaveRequest(StrictModel):
    account_email: str | None = None
    account_id: str | None = None
    label: str | None = None


class BundleSaveResponse(StrictModel):
    bundle_id: str
    saved: bool
    status: BundleStatus
    expires_at: datetime | None = None
    message: str


class BundleCleanupResponse(StrictModel):
    deleted_count: int = Field(ge=0)
    deleted_bundle_ids: list[str] = Field(default_factory=list)


class QuotaStatus(StrictModel):
    actor: str
    period: str
    limit: int
    used: int = Field(ge=0)
    remaining: int = Field(ge=0)


class MatrixBundle(StrictModel):
    bundle_id: str
    blueprint_id: str = "bp_demo_standard"
    status: BundleStatus = BundleStatus.READY
    title: str
    created_at: datetime | None = None
    expires_at: datetime | None = None
    bundle_url: str | None = None
    download_url: str | None = None
    signed_download_url: str | None = None
    manifest_url: str | None = None
    manifest_digest: str | None = None
    zip_digest: str | None = None
    zip_size_bytes: int | None = Field(default=None, ge=0)
    file_count: int | None = Field(default=None, ge=0)
    expires_in_seconds: int = Field(default=172800, ge=0)
    persisted: bool = False
    owner_id: str | None = None
    storage_uri: str | None = None
    files: list[BundleFile] = Field(default_factory=list)
    tree: list[BundleTreeNode] = Field(default_factory=list)
    prompts_available: list[CoderId] = Field(default_factory=list)
    standards: list[str] = Field(default_factory=list)
    validation: ValidationStatus = ValidationStatus.NOT_RUN
    links: dict[str, str] = Field(default_factory=dict)
