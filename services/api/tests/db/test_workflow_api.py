"""Batch C2 exit criteria: the full Continuous Build loop over HTTP, persisted.

create project -> create version -> create batch -> generate prompt pack -> submit changes ->
validation run -> commit-or-repair, all via the FastAPI app against a real RLS-enforced Postgres
and an authenticated Supabase JWT. Also asserts the version-conflict guard and RLS isolation
between two users at the HTTP layer.
"""

from __future__ import annotations

import os
import time
import uuid

import jwt
import pytest

USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"
_SECRET = "dev-only-change-me"  # matches the default supabase_jwt_secret


def _token(sub: str) -> str:
    return jwt.encode(
        {"sub": sub, "aud": "authenticated", "exp": int(time.time()) + 3600},
        _SECRET,
        algorithm="HS256",
    )


def _auth(sub: str) -> dict[str, str]:
    # RLS identity is the JWT sub; the x-matrix-user-id header only keys the rate limiter, so make
    # it unique per request — these suites aren't testing rate limiting and the app singleton's
    # buckets would otherwise accumulate across the whole session and spuriously 429.
    return {"Authorization": f"Bearer {_token(sub)}", "x-matrix-user-id": f"{sub}:{uuid.uuid4().hex}"}


@pytest.fixture()
def client(pg_cluster):
    """A TestClient bound to the throwaway Postgres cluster (RLS-enforced app role)."""
    from app.core.config import get_settings
    from app.db.engine import reset_engine_cache

    prev = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = pg_cluster["app_dsn"]
    get_settings.cache_clear()
    reset_engine_cache()

    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c

    reset_engine_cache()
    if prev is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = prev
    get_settings.cache_clear()


def _create_project_and_version(client) -> tuple[str, str]:
    p = client.post(
        "/api/v1/projects",
        json={"title": "Repo Intelligence Agent", "slug": "repo-intelligence-agent"},
        headers=_auth(USER_A),
    )
    assert p.status_code == 201, p.text
    project_id = p.json()["id"]

    v = client.post(
        "/api/v1/versions",
        json={"project_id": project_id, "version_label": "v1.0.0", "title": "Initial"},
        headers=_auth(USER_A),
    )
    assert v.status_code == 201, v.text
    return project_id, v.json()["id"]


def test_full_loop_approved_path(client) -> None:
    _, version_id = _create_project_and_version(client)

    # Create a batch (draft).
    b = client.post(
        "/api/v1/batches",
        json={"version_id": version_id, "goal_md": "Add the health endpoint", "change_type": "add-feature"},
        headers=_auth(USER_A),
    )
    assert b.status_code == 201, b.text
    batch_id = b.json()["id"]
    assert b.json()["status"] == "draft"

    # Generate the prompt pack -> batch becomes ready.
    pp = client.post(
        f"/api/v1/batches/{batch_id}/prompt-pack",
        json={"coder": "claude-code"},
        headers=_auth(USER_A),
    )
    assert pp.status_code == 201, pp.text
    assert pp.json()["batch_status"] == "ready"
    assert "Matrix Batch Prompt" in pp.json()["prompt_text"]

    # Submit a clean, in-scope change set -> approved -> committed.
    ex = client.post(
        f"/api/v1/batches/{batch_id}/executions",
        json={
            "coder": "claude-code",
            "changed_files": [
                {"path": "backend/app/api/health.py", "change_type": "modified"},
                {"path": "tests/test_health.py", "change_type": "added"},
            ],
            "summary": "Implement health endpoint",
        },
        headers=_auth(USER_A),
    )
    assert ex.status_code == 201, ex.text
    body = ex.json()
    assert body["outcome"] == "committed"
    assert body["validation_run"]["status"] == "approved"
    assert body["validation_run"]["ui_label"] == "Passed"
    assert body["commit"]["validation_status"] == "approved"
    commit_id = body["commit"]["id"]

    # Diff + artifacts are persisted for the commit.
    diff = client.get(f"/api/v1/commits/{commit_id}/diff", headers=_auth(USER_A))
    assert diff.status_code == 200
    assert "A tests/test_health.py" in diff.json()["patch"]

    arts = client.get(f"/api/v1/commits/{commit_id}/artifacts", headers=_auth(USER_A))
    assert arts.status_code == 200
    assert {a["artifact_type"] for a in arts.json()} == {"patch_diff"}

    # Timeline reflects the batch and the commit.
    tl = client.get(f"/api/v1/versions/{version_id}/timeline", headers=_auth(USER_A))
    assert tl.status_code == 200
    kinds = [e["kind"] for e in tl.json()["entries"]]
    assert "batch" in kinds and "commit" in kinds


def test_full_loop_repair_path(client) -> None:
    _, version_id = _create_project_and_version(client)
    b = client.post(
        "/api/v1/batches",
        json={"version_id": version_id, "goal_md": "Tweak the pipeline"},
        headers=_auth(USER_A),
    )
    batch_id = b.json()["id"]
    client.post(
        f"/api/v1/batches/{batch_id}/prompt-pack", json={"coder": "claude-code"}, headers=_auth(USER_A)
    )

    # Editing a Matrix control file is a hard violation -> rejected.
    ex = client.post(
        f"/api/v1/batches/{batch_id}/executions",
        json={"changed_files": [{"path": "MATRIX_STANDARDS.lock", "change_type": "modified"}]},
        headers=_auth(USER_A),
    )
    assert ex.status_code == 201, ex.text
    body = ex.json()
    assert body["validation_run"]["status"] == "rejected"
    assert body["validation_run"]["ui_label"] == "Rejected"
    assert body["outcome"] == "rejected"
    run_id = body["validation_run"]["id"]
    assert any(f["check_name"] == "forbidden_changes_absent" for f in body["validation_run"]["findings"])

    # A repair batch is planned from the failing run and ships ready with a prompt.
    rb = client.post(
        "/api/v1/repair-batches",
        json={"validation_run_id": run_id, "coder": "claude-code"},
        headers=_auth(USER_A),
    )
    assert rb.status_code == 201, rb.text
    assert rb.json()["batch_status"] == "ready"


def test_version_conflict_guard(client) -> None:
    project_id, v1_id = _create_project_and_version(client)
    # A newer version becomes current.
    client.post(
        "/api/v1/versions",
        json={"project_id": project_id, "version_label": "v1.2.0", "title": "Next"},
        headers=_auth(USER_A),
    )
    # Trying to batch on the stale v1.0.0 is a 409.
    r = client.post(
        "/api/v1/batches",
        json={"version_id": v1_id, "goal_md": "late change"},
        headers=_auth(USER_A),
    )
    assert r.status_code == 409, r.text
    assert "v1.0.0" in r.json()["detail"] and "v1.2.0" in r.json()["detail"]


def test_requires_auth(client) -> None:
    assert client.get("/api/v1/projects").status_code == 401


def test_version_thumbnail_is_served_and_stable(client) -> None:
    _, version_id = _create_project_and_version(client)
    r = client.get(f"/api/v1/versions/{version_id}/thumbnail.svg", headers=_auth(USER_A))
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("image/svg+xml")
    assert r.headers["X-Thumbnail-Status"] == "active"  # no commits yet
    assert r.text.startswith("<svg") and 'viewBox="0 0 100 100"' in r.text
    # Deterministic + idempotent: a second request returns identical bytes.
    again = client.get(f"/api/v1/versions/{version_id}/thumbnail.svg", headers=_auth(USER_A))
    assert again.text == r.text


def test_rls_isolation_between_users_over_http(client) -> None:
    project_id, _ = _create_project_and_version(client)
    # User B cannot see or fetch user A's project.
    assert client.get("/api/v1/projects", headers=_auth(USER_B)).json() == []
    assert client.get(f"/api/v1/projects/{project_id}", headers=_auth(USER_B)).status_code == 404
    # User A still sees it.
    mine = client.get("/api/v1/projects", headers=_auth(USER_A)).json()
    assert [p["id"] for p in mine] == [project_id]
