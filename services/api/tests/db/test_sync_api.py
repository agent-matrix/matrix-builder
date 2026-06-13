"""Track L2: the /v1/sync endpoint upserts a local .mb/ workspace by id, owner-scoped.

Mirrors what `mb sync` pushes: a content-addressed project/version/batch/commit. Asserts the rows
land in the timeline, that a second push is idempotent, that RLS isolates a second user, and that
the version-conflict guard rejects pushing a stale version over a newer one.
"""

from __future__ import annotations

import os
import time
import uuid

import jwt
import pytest

USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"
_SECRET = "dev-only-change-me"


def _token(sub: str) -> str:
    return jwt.encode(
        {"sub": sub, "aud": "authenticated", "exp": int(time.time()) + 3600}, _SECRET, algorithm="HS256"
    )


def _auth(sub: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {_token(sub)}", "x-matrix-user-id": f"{sub}:{uuid.uuid4().hex}"}


@pytest.fixture()
def client(pg_cluster):
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


def _payload(version_label: str = "v1.0.0") -> dict:
    return {
        "project": {"id": "bp-abc123", "slug": "repo-intel", "title": "Repo Intelligence"},
        "version": {"id": "bv-abc123", "project_id": "bp-abc123", "version_label": version_label, "title": "Initial"},
        "batches": [
            {"id": "bat-001", "version_id": "bv-abc123", "ordinal": 1, "title": "Add health",
             "goal_md": "Add /health", "change_type": "add-feature", "status": "committed"},
        ],
        "commits": [
            {"id": "mc-001", "batch_id": "bat-001", "version_id": "bv-abc123", "commit_no": 1,
             "summary": "health endpoint", "tree_hash": "sha256:deadbeef", "validation_status": "approved",
             "manifest": {"added": ["backend/app/api/health.py"]}},
        ],
    }


def test_sync_upserts_and_is_idempotent(client) -> None:
    r = client.post("/api/v1/sync", json=_payload(), headers=_auth(USER_A))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["project_id"] == "bp-abc123" and body["version_id"] == "bv-abc123"
    assert body["applied"] == {"batches": 1, "commits": 1}
    kinds = [e["kind"] for e in body["timeline"]["entries"]]
    assert "batch" in kinds and "commit" in kinds

    # Re-push: same ids -> upsert, not duplicate.
    again = client.post("/api/v1/sync", json=_payload(), headers=_auth(USER_A))
    assert again.status_code == 200, again.text
    batches = [e for e in again.json()["timeline"]["entries"] if e["kind"] == "batch"]
    commits = [e for e in again.json()["timeline"]["entries"] if e["kind"] == "commit"]
    assert len(batches) == 1 and len(commits) == 1

    # It reads back via the normal API too.
    tl = client.get("/api/v1/versions/bv-abc123/timeline", headers=_auth(USER_A))
    assert tl.status_code == 200
    assert tl.json()["version_label"] == "v1.0.0"


def test_sync_is_owner_isolated(client) -> None:
    client.post("/api/v1/sync", json=_payload(), headers=_auth(USER_A))
    # User B cannot see user A's synced project/version.
    assert client.get("/api/v1/projects", headers=_auth(USER_B)).json() == []
    assert client.get("/api/v1/versions/bv-abc123/timeline", headers=_auth(USER_B)).status_code == 404


def test_sync_version_conflict_guard(client) -> None:
    # A newer version is current on the server (e.g. an "update requirements" bump)…
    newer = {
        "project": {"id": "bp-abc123", "slug": "repo-intel", "title": "Repo Intelligence"},
        "version": {"id": "bv-newer", "project_id": "bp-abc123", "version_label": "v1.2.0", "title": "Next"},
        "batches": [],
        "commits": [],
    }
    assert client.post("/api/v1/sync", json=newer, headers=_auth(USER_A)).status_code == 200
    # …pushing a stale v1.0.0 (different id) is rejected by the version-conflict guard.
    r = client.post("/api/v1/sync", json=_payload(version_label="v1.0.0"), headers=_auth(USER_A))
    assert r.status_code == 409, r.text
    assert "v1.0.0" in r.json()["detail"] and "v1.2.0" in r.json()["detail"]
