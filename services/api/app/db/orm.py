"""SQLAlchemy ORM — the real persistence layer (Batch C1).

Replaces the placeholder dataclass ``Entity``/``InMemoryRepository`` with mapped Postgres
tables. The schema follows the design document's SQL baseline (users, projects, and the seven
workflow tables) with one deliberate addition: every workflow table carries a denormalized
``owner_id`` so row-level security can be a simple, fast ``owner_id = app_current_user()``
policy rather than a deep parent-chain subquery.

Tables (DDL + RLS) are created by the Alembic migration, not by ``create_all``, so the RLS
policies and the ``app_current_user()`` helper are part of the versioned schema.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Tables that are exposed to API callers and therefore get owner-scoped RLS.
RLS_TABLES: tuple[str, ...] = (
    "projects",
    "bundle_versions",
    "build_batches",
    "matrix_commits",
    "prompt_versions",
    "validation_runs",
    "validation_findings",
    "artifacts",
    "run_events",
    "gitpilot_runs",
    "design_bundles",
)


class Base(DeclarativeBase):
    pass


def _pk() -> Mapped[str]:
    # UUIDs generated app-side (or by gen_random_uuid in the migration default).
    return mapped_column(String(36), primary_key=True)


def _ts() -> Mapped[datetime]:
    return mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = _pk()
    email: Mapped[str | None] = mapped_column(String(320), unique=True)
    display_name: Mapped[str | None] = mapped_column(String(200))
    plan: Mapped[str] = mapped_column(String(32), default="free", nullable=False)
    created_at: Mapped[datetime] = _ts()


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[str] = _pk()
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    privacy: Mapped[str] = mapped_column(String(16), default="private", nullable=False)
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = _ts()


class BundleVersion(Base):
    __tablename__ = "bundle_versions"
    id: Mapped[str] = _pk()
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_version_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("bundle_versions.id")
    )
    version_label: Mapped[str] = mapped_column(String(32), nullable=False)  # v1.0.0
    title: Mapped[str] = mapped_column(Text, nullable=False)
    requirements_md: Mapped[str] = mapped_column(Text, default="", nullable=False)
    blueprint_artifact_id: Mapped[str | None] = mapped_column(String(36))
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = _ts()


class BuildBatch(Base):
    __tablename__ = "build_batches"
    __table_args__ = (UniqueConstraint("version_id", "ordinal", name="uq_batch_ordinal"),)
    id: Mapped[str] = _pk()
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("bundle_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_commit_id: Mapped[str | None] = mapped_column(String(36))
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    goal_md: Mapped[str] = mapped_column(Text, default="", nullable=False)
    change_type: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # small-update|add-feature|fix-issue
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    requested_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = _ts()


class MatrixCommit(Base):
    __tablename__ = "matrix_commits"
    __table_args__ = (UniqueConstraint("version_id", "commit_no", name="uq_commit_no"),)
    id: Mapped[str] = _pk()
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    batch_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("build_batches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("bundle_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_commit_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("matrix_commits.id")
    )
    commit_no: Mapped[int] = mapped_column(Integer, nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    tree_hash: Mapped[str] = mapped_column(String(80), nullable=False)
    validation_status: Mapped[str] = mapped_column(String(32), default="not-run", nullable=False)
    prompt_pack_id: Mapped[str | None] = mapped_column(String(36))
    # The commit manifest (added/changed/deleted file lists + scope), persisted so diffs and
    # the build timeline can be reconstructed without re-reading object storage (Batch C2).
    manifest: Mapped[dict] = mapped_column("manifest_jsonb", JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = _ts()


class PromptVersion(Base):
    __tablename__ = "prompt_versions"
    id: Mapped[str] = _pk()
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    batch_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("build_batches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    coder: Mapped[str] = mapped_column(String(32), nullable=False)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    constraints: Mapped[dict] = mapped_column(
        "constraints_jsonb", JSONB, default=dict, nullable=False
    )
    artifact_id: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = _ts()


class ValidationRun(Base):
    __tablename__ = "validation_runs"
    id: Mapped[str] = _pk()
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    # Nullable since C3: an async run is validated *before* a commit exists; the commit is
    # created only on approval, otherwise the run carries a repair suggestion instead.
    commit_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("matrix_commits.id", ondelete="CASCADE"), index=True
    )
    batch_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("build_batches.id", ondelete="CASCADE"), index=True
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # running|approved|needs-repair|rejected|failed
    score: Mapped[int | None] = mapped_column(Integer)
    runner: Mapped[str] = mapped_column(String(32), default="local", nullable=False)
    started_at: Mapped[datetime] = _ts()
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ValidationFinding(Base):
    __tablename__ = "validation_findings"
    id: Mapped[str] = _pk()
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    validation_run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("validation_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    check_name: Mapped[str] = mapped_column(String(120), nullable=False)
    file_path: Mapped[str | None] = mapped_column(Text)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    remediation: Mapped[str | None] = mapped_column(Text)


class RunEvent(Base):
    """Append-only event log for a validation run (Batch C3).

    Rows are never updated or deleted. ``seq`` is a per-run monotonic cursor: clients page with
    ``?after=`` and WebSocket subscribers replay missed events by ``seq`` before streaming live.
    """

    __tablename__ = "run_events"
    __table_args__ = (UniqueConstraint("run_id", "seq", name="uq_run_event_seq"),)
    id: Mapped[str] = _pk()
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("validation_runs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seq: Mapped[int] = mapped_column(BigInteger, nullable=False)
    event_type: Mapped[str] = mapped_column(String(48), nullable=False)
    payload: Mapped[dict] = mapped_column("payload_jsonb", JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = _ts()


class Artifact(Base):
    __tablename__ = "artifacts"
    id: Mapped[str] = _pk()
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    project_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("bundle_versions.id", ondelete="CASCADE")
    )
    commit_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("matrix_commits.id", ondelete="CASCADE")
    )
    artifact_type: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # bundle_zip|prompt_md|patch_diff|log|manifest|thumbnail_svg
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[str] = mapped_column(String(80), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = _ts()


class GitPilotRun(Base):
    """A GitPilot run (cloud or local) recorded for history + audit (Batch 10).

    Owner-scoped like every other workflow table. Records the run id, the bundle
    it targeted, the synced GitPilot status, and the Matrix verdict — so a user's
    runs survive restarts and are queryable.
    """

    __tablename__ = "gitpilot_runs"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # the gp-run-... id
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    bundle_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    task_id: Mapped[str | None] = mapped_column(String(64))
    source: Mapped[str] = mapped_column(String(32), default="cloud")  # cloud|local
    status: Mapped[str] = mapped_column(String(32), default="queued")
    test_status: Mapped[str] = mapped_column(String(32), default="not_run")
    summary: Mapped[str] = mapped_column(Text, default="")
    changed_files: Mapped[dict] = mapped_column(JSONB, default=list)
    # Matrix verdict (approved|needs-repair|rejected) — null until validated.
    validation_status: Mapped[str | None] = mapped_column(String(32))
    can_commit: Mapped[bool] = mapped_column(default=False)
    parent_run_id: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class DesignBundleRecord(Base):
    """A saved Matrix Designer Blueprint Details + chat for a build (batch-10).

    Owner-scoped like every other workflow table. Keyed by (owner, build, candidate)
    so reopening a build restores the same blueprint and Talk-to-blueprint history.
    """

    __tablename__ = "design_bundles"
    id: Mapped[str] = _pk()
    owner_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    build_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    candidate_id: Mapped[str] = mapped_column(String(32), nullable=False)
    idea: Mapped[str] = mapped_column(Text, default="")
    details: Mapped[dict] = mapped_column(JSONB, default=dict)
    chat_history: Mapped[list] = mapped_column(JSONB, default=list)
    created_at: Mapped[datetime] = _ts()
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    __table_args__ = (UniqueConstraint("owner_id", "build_id", "candidate_id", name="uq_design_bundle_owner_build_cand"),)


__all__ = [
    "Base",
    "RLS_TABLES",
    "User",
    "Project",
    "BundleVersion",
    "BuildBatch",
    "MatrixCommit",
    "PromptVersion",
    "ValidationRun",
    "ValidationFinding",
    "RunEvent",
    "Artifact",
    "GitPilotRun",
    "DesignBundleRecord",
]
