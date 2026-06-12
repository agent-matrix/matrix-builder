from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class BuildType(StrEnum):
    APP = "app"
    AGENT = "agent"
    API = "api"


class Goal(StrEnum):
    PORTFOLIO = "portfolio"
    STARTUP_MVP = "startup-mvp"
    INTERNAL_TOOL = "internal-tool"
    LEARNING = "learning"
    OPEN_SOURCE = "open-source"
    ENTERPRISE = "enterprise"


class QualityLevel(StrEnum):
    STARTER = "starter"
    STANDARD = "standard"
    PRODUCTION = "production"
    ENTERPRISE = "enterprise"


class CoderId(StrEnum):
    CLAUDE_CODE = "claude-code"
    CODEX_CHATGPT = "codex-chatgpt"
    CURSOR = "cursor"
    GITPILOT = "gitpilot"
    IBM_BOB = "ibm-bob"
    GENERIC_AI_CODER = "generic-ai-coder"


class ValidationStatus(StrEnum):
    NOT_RUN = "not-run"
    APPROVED = "approved"
    NEEDS_REPAIR = "needs-repair"
    REJECTED = "rejected"


class BundleStatus(StrEnum):
    DRAFT = "draft"
    READY = "ready"
    EXPIRED = "expired"
    ARCHIVED = "archived"
    SAVED = "saved"


class ApiMessage(StrictModel):
    message: str


class ApiRoute(StrictModel):
    method: str = Field(pattern="^(GET|POST|PUT|PATCH|DELETE)$")
    path: str = Field(pattern="^/")
    summary: str | None = None
    auth_required: bool = False


class BundleFile(StrictModel):
    path: str = Field(min_length=1)
    kind: str = "control"
    required: bool = True
    content_type: str = "text/plain"
    digest: str | None = None
    size_bytes: int | None = Field(default=None, ge=0)


class ContractFileRef(StrictModel):
    path: str
    required: bool = True
    reason: str | None = None


JsonDict = dict[str, Any]
