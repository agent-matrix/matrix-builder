"""GitPilot PR flow gated on Matrix approval (Batch 11).

Opening a PR requires an approved Matrix verdict on the run — a GitPilot test
pass is never sufficient. Runs in mock mode (in-memory store).
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app


def _client() -> TestClient:
    # Unique rate-limit key so these requests don't drain the shared bucket.
    return TestClient(app, headers={"x-matrix-user-id": f"pr:{uuid.uuid4().hex}"})


def _approved_run(client: TestClient, bundle: str = "bundle_demo") -> str:
    run_id = client.post(f"/api/v1/bundles/{bundle}/gitpilot/runs", json={"task_id": "PR"}).json()[
        "run_id"
    ]
    client.get(f"/api/v1/gitpilot/runs/{run_id}")  # sync status into history
    client.post(f"/api/v1/bundles/{bundle}/gitpilot/runs/{run_id}/validate")  # records verdict
    return run_id


def test_pr_blocked_without_validation():
    client = _client()
    run_id = client.post(
        "/api/v1/bundles/bundle_demo/gitpilot/runs", json={"task_id": "PR"}
    ).json()["run_id"]
    # Not validated yet -> commit/PR is Matrix authority -> 409.
    resp = client.post(f"/api/v1/bundles/bundle_demo/gitpilot/runs/{run_id}/pr", json={})
    assert resp.status_code == 409
    assert "approval" in resp.json()["detail"].lower()


def test_pr_opens_when_matrix_approved():
    client = _client()
    run_id = _approved_run(client)
    resp = client.post(
        f"/api/v1/bundles/bundle_demo/gitpilot/runs/{run_id}/pr",
        json={"repo_url": "https://github.com/acme/app", "title": "Add hello world"},
    )
    # bundle_demo's clean diff validates as approved in mock mode.
    assert resp.status_code == 200
    body = resp.json()
    assert body["run_id"] == run_id
    assert body["pr_url"] and "github.com/acme/app/pull/" in body["pr_url"]
    assert body["status"] in {"draft", "created"}


def test_pr_unknown_run_is_409_not_500():
    client = _client()
    resp = client.post("/api/v1/bundles/bundle_demo/gitpilot/runs/gp-run-nope/pr", json={})
    assert resp.status_code == 409


def test_pr_uses_default_repo_when_unspecified():
    client = _client()
    run_id = _approved_run(client)
    body = client.post(f"/api/v1/bundles/bundle_demo/gitpilot/runs/{run_id}/pr", json={}).json()
    assert body["pr_url"] and "/pull/" in body["pr_url"]
