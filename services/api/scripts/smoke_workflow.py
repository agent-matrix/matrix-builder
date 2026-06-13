"""End-to-end workflow smoke against any PostgreSQL — used to prove the Aiven topology (ADR 0002).

Exercises the real ``WorkflowService`` code paths as the least-privilege app role: create
project -> version -> batch -> prompt pack -> approved execution -> commit, then assert that
row-level security isolates a second user, and that data survives a fresh connection. Mirrors
exactly how Matrix Builder talks to Aiven in production.

Prereqs: the schema is migrated (``alembic upgrade head`` as the admin role) and ``matrix_app``
exists (``aiven_setup.sql``).

Usage (Aiven or local):
    export APP_DATABASE_URL="postgresql+psycopg://matrix_app:...@host:port/defaultdb?sslmode=require"
    python scripts/smoke_workflow.py            # creates a demo project, verifies RLS, cleans up
    SMOKE_KEEP=1 python scripts/smoke_workflow.py   # leave the demo project behind

Exit 0 on success, 1 on failure.
"""

from __future__ import annotations

import os
import sys
import uuid

from sqlalchemy import text

from app.db.engine import reset_engine_cache, session_scope
from app.integrations.agent_generator_adapter import AgentGeneratorAdapter
from app.schemas.workflow import (
    BatchCreate,
    ChangedFile,
    ExecutionRequest,
    ProjectCreate,
    VersionCreate,
)
from app.services.workflow_service import WorkflowError, WorkflowService

APP_URL = os.environ.get("APP_DATABASE_URL") or os.environ.get("DATABASE_URL")
USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"
_adapter = AgentGeneratorAdapter(mode="mock")


def _as(uid: str, fn):
    with session_scope(user_id=uid, url=APP_URL) as session:
        return fn(WorkflowService(session=session, owner_id=uid, adapter=_adapter))


def _ok(msg: str) -> None:
    print(f"  [ok]   {msg}")


def main() -> int:
    if not APP_URL:
        print("APP_DATABASE_URL (or DATABASE_URL) must be set.")
        return 1
    where = APP_URL.split("@", 1)[-1]
    print(f"Matrix Builder workflow smoke — app role @ {where}\n")

    project = _as(USER_A, lambda w: w.create_project(
        ProjectCreate(title="Aiven Smoke", slug=f"aiven-smoke-{uuid.uuid4().hex[:6]}")))
    _ok(f"created project   {project.id}")

    version = _as(USER_A, lambda w: w.create_version(
        VersionCreate(project_id=project.id, title="Initial")))
    _ok(f"created version   {version.id}  ({version.version_label})")

    batch = _as(USER_A, lambda w: w.create_batch(
        BatchCreate(version_id=version.id, goal_md="Add a /health endpoint with a test")))
    _ok(f"created batch     {batch.id}  (Batch {batch.ordinal:02d})")

    bp, _prompt = _as(USER_A, lambda w: w.generate_prompt_pack(batch.id, "claude-code"))
    _ok(f"prompt pack ready batch status={bp.status}")

    commit, run, outcome, _ = _as(USER_A, lambda w: w.submit_execution(
        batch.id,
        ExecutionRequest(
            changed_files=[
                ChangedFile(path="backend/app/api/health.py"),
                ChangedFile(path="tests/test_health.py", change_type="added"),
            ],
            summary="health endpoint",
        ),
    ))
    assert outcome == "committed" and run.status == "approved", (outcome, run.status)
    _ok(f"clean change      -> {run.status} (score {run.score}); commit #{commit.commit_no}")

    # Row-level security: a second user must see and reach none of user A's rows.
    b_projects = _as(USER_B, lambda w: w.list_projects())
    assert all(p.id != project.id for p in b_projects), "RLS LEAK: user B saw user A's project"
    _ok("RLS               user B cannot list user A's project")
    try:
        _as(USER_B, lambda w: w.get_project(project.id))
        print("  [FAIL] RLS: user B fetched user A's project")
        return 1
    except WorkflowError as exc:
        assert exc.status_code == 404
        _ok(f"RLS               user B get_project denied ({exc.status_code})")

    # Persistence: drop the pool entirely, reconnect, read it back.
    reset_engine_cache()
    again = _as(USER_A, lambda w: w.list_projects())
    assert any(p.id == project.id for p in again), "project did not persist across reconnect"
    _ok("persistence       project survived a full engine reset (reconnect)")

    _version, entries = _as(USER_A, lambda w: w.timeline(version.id))
    _ok(f"timeline          {len(entries)} entr(ies): {[e['kind'] for e in entries]}")

    if os.environ.get("SMOKE_KEEP") == "1":
        _ok(f"kept demo project {project.id} (SMOKE_KEEP=1)")
    else:
        _as(USER_A, lambda w: w.repo.session.execute(
            text("DELETE FROM projects WHERE id = :id"), {"id": project.id}))
        _ok("cleanup           demo project deleted (cascade)")

    print("\nSMOKE OK — Aiven topology verified end to end.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
