"""Workflow persistence repository (Batch C1).

Thin data-access over the ORM for the Continuous Build tables. Every write stamps ``owner_id``
so row-level security isolates rows per user; callers run inside ``session_scope(user_id=...)``
so the same user id is set as the RLS GUC.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.orm import (
    Artifact,
    BuildBatch,
    BundleVersion,
    MatrixCommit,
    Project,
    PromptVersion,
    RunEvent,
    User,
    ValidationFinding,
    ValidationRun,
)


def _new_id() -> str:
    return str(uuid.uuid4())


class WorkflowRepository:
    def __init__(self, session: Session) -> None:
        self.session = session

    # --- users -------------------------------------------------------------
    def upsert_user(self, user_id: str, *, email: str | None = None, display_name: str | None = None) -> User:
        user = self.session.get(User, user_id)
        if user is None:
            user = User(id=user_id, email=email, display_name=display_name, plan="free")
            self.session.add(user)
        else:
            if email is not None:
                user.email = email
            if display_name is not None:
                user.display_name = display_name
        self.session.flush()
        return user

    # --- upsert (Track L2 sync: insert-or-update by primary key) -----------
    def upsert(self, obj):
        merged = self.session.merge(obj)
        self.session.flush()
        return merged

    # --- projects ----------------------------------------------------------
    def create_project(self, *, owner_id: str, title: str, slug: str, description: str = "") -> Project:
        project = Project(
            id=_new_id(), owner_id=owner_id, title=title, slug=slug, description=description
        )
        self.session.add(project)
        self.session.flush()
        return project

    def get_project(self, project_id: str) -> Project | None:
        return self.session.get(Project, project_id)

    def list_projects(self, owner_id: str) -> list[Project]:
        # RLS already restricts to the current user; the filter is belt-and-suspenders.
        return list(
            self.session.scalars(select(Project).where(Project.owner_id == owner_id)).all()
        )

    # --- versions ----------------------------------------------------------
    def create_version(
        self,
        *,
        owner_id: str,
        project_id: str,
        version_label: str,
        title: str,
        requirements_md: str = "",
        parent_version_id: str | None = None,
        blueprint_artifact_id: str | None = None,
    ) -> BundleVersion:
        version = BundleVersion(
            id=_new_id(),
            owner_id=owner_id,
            project_id=project_id,
            parent_version_id=parent_version_id,
            version_label=version_label,
            title=title,
            requirements_md=requirements_md,
            blueprint_artifact_id=blueprint_artifact_id,
            created_by=owner_id,
        )
        self.session.add(version)
        self.session.flush()
        return version

    def get_version(self, version_id: str) -> BundleVersion | None:
        return self.session.get(BundleVersion, version_id)

    def list_versions(self, project_id: str) -> list[BundleVersion]:
        return list(
            self.session.scalars(
                select(BundleVersion)
                .where(BundleVersion.project_id == project_id)
                .order_by(BundleVersion.created_at)
            ).all()
        )

    def latest_version(self, project_id: str) -> BundleVersion | None:
        versions = self.list_versions(project_id)
        return versions[-1] if versions else None

    # --- batches -----------------------------------------------------------
    def create_batch(
        self,
        *,
        owner_id: str,
        version_id: str,
        ordinal: int,
        title: str,
        goal_md: str,
        change_type: str,
        parent_commit_id: str | None = None,
    ) -> BuildBatch:
        batch = BuildBatch(
            id=_new_id(),
            owner_id=owner_id,
            version_id=version_id,
            ordinal=ordinal,
            title=title,
            goal_md=goal_md,
            change_type=change_type,
            parent_commit_id=parent_commit_id,
            requested_by=owner_id,
        )
        self.session.add(batch)
        self.session.flush()
        return batch

    def get_batch(self, batch_id: str) -> BuildBatch | None:
        return self.session.get(BuildBatch, batch_id)

    def list_batches(self, version_id: str) -> list[BuildBatch]:
        return list(
            self.session.scalars(
                select(BuildBatch)
                .where(BuildBatch.version_id == version_id)
                .order_by(BuildBatch.ordinal)
            ).all()
        )

    def set_batch_status(self, batch: BuildBatch, status: str) -> BuildBatch:
        batch.status = status
        self.session.flush()
        return batch

    def next_batch_ordinal(self, version_id: str) -> int:
        current = self.session.scalar(
            select(func.max(BuildBatch.ordinal)).where(BuildBatch.version_id == version_id)
        )
        return (current or 0) + 1

    # --- prompt versions ---------------------------------------------------
    def create_prompt_version(
        self,
        *,
        owner_id: str,
        batch_id: str,
        coder: str,
        prompt_text: str,
        constraints: dict | None = None,
        artifact_id: str | None = None,
    ) -> PromptVersion:
        prompt = PromptVersion(
            id=_new_id(),
            owner_id=owner_id,
            batch_id=batch_id,
            coder=coder,
            prompt_text=prompt_text,
            constraints=constraints or {},
            artifact_id=artifact_id,
        )
        self.session.add(prompt)
        self.session.flush()
        return prompt

    def list_prompt_versions(self, batch_id: str) -> list[PromptVersion]:
        return list(
            self.session.scalars(
                select(PromptVersion)
                .where(PromptVersion.batch_id == batch_id)
                .order_by(PromptVersion.created_at)
            ).all()
        )

    # --- commits -----------------------------------------------------------
    def create_commit(
        self,
        *,
        owner_id: str,
        batch_id: str,
        version_id: str,
        commit_no: int,
        tree_hash: str,
        summary: str = "",
        validation_status: str = "not-run",
        parent_commit_id: str | None = None,
        manifest: dict | None = None,
    ) -> MatrixCommit:
        commit = MatrixCommit(
            id=_new_id(),
            owner_id=owner_id,
            batch_id=batch_id,
            version_id=version_id,
            commit_no=commit_no,
            tree_hash=tree_hash,
            summary=summary,
            validation_status=validation_status,
            parent_commit_id=parent_commit_id,
            manifest=manifest or {},
        )
        self.session.add(commit)
        self.session.flush()
        return commit

    def get_commit(self, commit_id: str) -> MatrixCommit | None:
        return self.session.get(MatrixCommit, commit_id)

    def list_commits(self, version_id: str) -> list[MatrixCommit]:
        return list(
            self.session.scalars(
                select(MatrixCommit)
                .where(MatrixCommit.version_id == version_id)
                .order_by(MatrixCommit.commit_no)
            ).all()
        )

    def latest_commit(self, version_id: str) -> MatrixCommit | None:
        commits = self.list_commits(version_id)
        return commits[-1] if commits else None

    def next_commit_no(self, version_id: str) -> int:
        current = self.session.scalar(
            select(func.max(MatrixCommit.commit_no)).where(MatrixCommit.version_id == version_id)
        )
        return (current or 0) + 1

    def set_commit_validation_status(self, commit: MatrixCommit, status: str) -> MatrixCommit:
        commit.validation_status = status
        self.session.flush()
        return commit

    # --- validation runs + findings ---------------------------------------
    def create_validation_run(
        self,
        *,
        owner_id: str,
        commit_id: str | None = None,
        batch_id: str | None = None,
        status: str,
        score: int | None = None,
        runner: str = "local",
    ) -> ValidationRun:
        run = ValidationRun(
            id=_new_id(),
            owner_id=owner_id,
            commit_id=commit_id,
            batch_id=batch_id,
            status=status,
            score=score,
            runner=runner,
        )
        self.session.add(run)
        self.session.flush()
        return run

    def get_validation_run(self, run_id: str) -> ValidationRun | None:
        return self.session.get(ValidationRun, run_id)

    def list_runs_for_version(self, version_id: str) -> list[ValidationRun]:
        return list(
            self.session.scalars(
                select(ValidationRun)
                .join(BuildBatch, BuildBatch.id == ValidationRun.batch_id)
                .where(BuildBatch.version_id == version_id)
                .order_by(ValidationRun.started_at)
            ).all()
        )

    def finalize_validation_run(
        self,
        run: ValidationRun,
        *,
        status: str,
        score: int | None = None,
        commit_id: str | None = None,
    ) -> ValidationRun:
        from app.utils.time import utc_now

        run.status = status
        if score is not None:
            run.score = score
        if commit_id is not None:
            run.commit_id = commit_id
        run.ended_at = utc_now()
        self.session.flush()
        return run

    # --- run events (append-only) -----------------------------------------
    def append_run_event(
        self,
        *,
        owner_id: str,
        run_id: str,
        event_type: str,
        payload: dict | None = None,
    ) -> RunEvent:
        next_seq = (
            self.session.scalar(
                select(func.max(RunEvent.seq)).where(RunEvent.run_id == run_id)
            )
            or 0
        ) + 1
        event = RunEvent(
            id=_new_id(),
            owner_id=owner_id,
            run_id=run_id,
            seq=next_seq,
            event_type=event_type,
            payload=payload or {},
        )
        self.session.add(event)
        self.session.flush()
        return event

    def list_run_events_after(self, run_id: str, after: int = 0) -> list[RunEvent]:
        return list(
            self.session.scalars(
                select(RunEvent)
                .where(RunEvent.run_id == run_id, RunEvent.seq > after)
                .order_by(RunEvent.seq)
            ).all()
        )

    def create_validation_finding(
        self,
        *,
        owner_id: str,
        validation_run_id: str,
        severity: str,
        status: str,
        check_name: str,
        message: str,
        file_path: str | None = None,
        remediation: str | None = None,
    ) -> ValidationFinding:
        finding = ValidationFinding(
            id=_new_id(),
            owner_id=owner_id,
            validation_run_id=validation_run_id,
            severity=severity,
            status=status,
            check_name=check_name,
            message=message,
            file_path=file_path,
            remediation=remediation,
        )
        self.session.add(finding)
        self.session.flush()
        return finding

    def list_findings(self, validation_run_id: str) -> list[ValidationFinding]:
        return list(
            self.session.scalars(
                select(ValidationFinding).where(
                    ValidationFinding.validation_run_id == validation_run_id
                )
            ).all()
        )

    # --- artifacts ---------------------------------------------------------
    def create_artifact(
        self,
        *,
        owner_id: str,
        project_id: str,
        artifact_type: str,
        storage_key: str,
        sha256: str,
        size_bytes: int,
        version_id: str | None = None,
        commit_id: str | None = None,
    ) -> Artifact:
        artifact = Artifact(
            id=_new_id(),
            owner_id=owner_id,
            project_id=project_id,
            version_id=version_id,
            commit_id=commit_id,
            artifact_type=artifact_type,
            storage_key=storage_key,
            sha256=sha256,
            size_bytes=size_bytes,
        )
        self.session.add(artifact)
        self.session.flush()
        return artifact

    def find_artifact_by_key(self, storage_key: str) -> Artifact | None:
        return self.session.scalars(
            select(Artifact).where(Artifact.storage_key == storage_key).limit(1)
        ).first()

    def list_artifacts_for_commit(self, commit_id: str) -> list[Artifact]:
        return list(
            self.session.scalars(
                select(Artifact).where(Artifact.commit_id == commit_id)
            ).all()
        )


def persist_saved_bundle(
    repo: WorkflowRepository,
    *,
    owner_id: str,
    title: str,
    slug: str,
    requirements_md: str = "",
    version_label: str = "v1.0.0",
) -> tuple[Project, BundleVersion]:
    """Save a guest bundle privately: create the owning project and its initial version.

    This is what the "Save privately" action persists, so a saved bundle survives a restart.
    """
    repo.upsert_user(owner_id)
    project = repo.create_project(owner_id=owner_id, title=title, slug=slug)
    version = repo.create_version(
        owner_id=owner_id,
        project_id=project.id,
        version_label=version_label,
        title=title,
        requirements_md=requirements_md,
    )
    return project, version


__all__ = ["WorkflowRepository", "persist_saved_bundle"]
