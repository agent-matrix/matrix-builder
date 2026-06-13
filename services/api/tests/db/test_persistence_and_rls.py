"""Batch C1 exit criteria: persistence across restarts + RLS cross-user denial."""

from __future__ import annotations

import time

import jwt
import pytest

from app.core.auth import AuthError, user_id_from_token
from app.db.engine import reset_engine_cache, session_scope
from app.db.repository import WorkflowRepository, persist_saved_bundle

USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"


# --- persistence across restarts -------------------------------------------

def test_saved_bundle_persists_across_restart(app_dsn: str) -> None:
    # Save privately as user A.
    with session_scope(user_id=USER_A, url=app_dsn) as s:
        project, version = persist_saved_bundle(
            WorkflowRepository(s),
            owner_id=USER_A,
            title="GitHub Repo Intelligence Agent",
            slug="github-repo-intelligence-agent",
        )
        project_id, version_id = project.id, version.id

    # Simulate a process restart: dispose the engine/pool entirely.
    reset_engine_cache()

    # A fresh engine reads the saved bundle back.
    with session_scope(user_id=USER_A, url=app_dsn) as s:
        repo = WorkflowRepository(s)
        projects = repo.list_projects(USER_A)
        assert [p.id for p in projects] == [project_id]
        versions = repo.list_versions(project_id)
        assert [v.id for v in versions] == [version_id]
        assert versions[0].version_label == "v1.0.0"


# --- RLS isolation ----------------------------------------------------------

def test_rls_denies_cross_user_reads(app_dsn: str) -> None:
    # User A creates a project.
    with session_scope(user_id=USER_A, url=app_dsn) as s:
        persist_saved_bundle(
            WorkflowRepository(s), owner_id=USER_A, title="A's project", slug="a-project"
        )

    # User B sees none of A's rows (RLS scopes every SELECT to the current user).
    with session_scope(user_id=USER_B, url=app_dsn) as s:
        assert WorkflowRepository(s).list_projects(USER_A) == []
        assert WorkflowRepository(s).list_projects(USER_B) == []

    # User A still sees their own row.
    with session_scope(user_id=USER_A, url=app_dsn) as s:
        assert len(WorkflowRepository(s).list_projects(USER_A)) == 1


def test_rls_blocks_writing_rows_for_another_user(app_dsn: str) -> None:
    # User B cannot insert a row owned by user A (WITH CHECK denies it).
    import sqlalchemy.exc

    with pytest.raises(sqlalchemy.exc.ProgrammingError), session_scope(
        user_id=USER_B, url=app_dsn
    ) as s:
        WorkflowRepository(s).create_project(owner_id=USER_A, title="forged", slug="forged")


def test_no_user_context_sees_nothing(app_dsn: str) -> None:
    # Seed a row as A, then read with no GUC set: RLS denies by default.
    with session_scope(user_id=USER_A, url=app_dsn) as s:
        persist_saved_bundle(
            WorkflowRepository(s), owner_id=USER_A, title="A2", slug="a2"
        )
    with session_scope(url=app_dsn) as s:  # no user_id -> GUC unset -> app_current_user() NULL
        assert WorkflowRepository(s).list_projects(USER_A) == []


# --- JWT verification -------------------------------------------------------

def test_jwt_round_trip() -> None:
    secret = "dev-only-change-me"  # matches the default supabase_jwt_secret
    token = jwt.encode(
        {"sub": USER_A, "aud": "authenticated", "exp": int(time.time()) + 3600},
        secret,
        algorithm="HS256",
    )
    assert user_id_from_token(token) == USER_A


def test_jwt_rejects_bad_signature() -> None:
    token = jwt.encode(
        {"sub": USER_A, "aud": "authenticated", "exp": int(time.time()) + 3600},
        "wrong-secret",
        algorithm="HS256",
    )
    with pytest.raises(AuthError):
        user_id_from_token(token)
