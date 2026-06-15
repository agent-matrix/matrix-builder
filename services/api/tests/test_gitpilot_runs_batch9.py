"""Cloud GitPilot run-create + result-sync (Batches 5 & 6).

Mock mode (default) runs fully offline: the service signs the bundle URL
server-side and returns deterministic runs without touching a live GitPilot.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.gitpilot import GitPilotRunRequest
from app.services.gitpilot_run_service import MATRIX_CONTROL_FILES, GitPilotRunService


def _client() -> TestClient:
    return TestClient(app)


def test_create_run_returns_run_id_and_url():
    client = _client()
    resp = client.post(
        "/api/v1/bundles/bundle_demo/gitpilot/runs",
        json={"task_id": "TASK-001", "prompt": "Implement the health endpoint", "allowed_files": ["tests/**"]},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "queued"
    assert body["run_id"].startswith("gp-run-")
    assert body["url"]


def test_create_run_with_empty_body_defaults():
    client = _client()
    resp = client.post("/api/v1/bundles/bundle_demo/gitpilot/runs")
    assert resp.status_code == 200
    assert resp.json()["status"] == "queued"


def test_run_status_reflects_diff_logs_tests():
    client = _client()
    created = client.post("/api/v1/bundles/bundle_demo/gitpilot/runs", json={"task_id": "TASK-007"})
    run_id = created.json()["run_id"]

    status = client.get(f"/api/v1/gitpilot/runs/{run_id}")
    assert status.status_code == 200
    body = status.json()
    assert body["run_id"] == run_id
    assert body["status"] == "completed"
    assert body["test_status"] in {"passed", "failed", "skipped"}
    assert body["changed_files"]
    # diff/logs are proxied through Matrix Builder (MB-relative, no GitPilot host).
    assert body["diff_url"] == f"/api/v1/gitpilot/runs/{run_id}/diff"
    assert body["logs_url"] == f"/api/v1/gitpilot/runs/{run_id}/logs"

    diff = client.get(f"/api/v1/gitpilot/runs/{run_id}/diff")
    assert diff.status_code == 200 and "test_health" in diff.text
    logs = client.get(f"/api/v1/gitpilot/runs/{run_id}/logs")
    assert logs.status_code == 200 and logs.text


def test_status_never_auto_promotes_to_approved():
    client = _client()
    created = client.post("/api/v1/bundles/bundle_demo/gitpilot/runs", json={"task_id": "TASK-009"})
    run_id = created.json()["run_id"]
    body = client.get(f"/api/v1/gitpilot/runs/{run_id}").json()
    # GitPilot reports implementation state only — never a Matrix verdict.
    assert body["status"] != "approved"
    assert body["status"] in {"queued", "running", "completed", "blocked", "error", "needs_approval"}


def test_no_secrets_leak_to_client():
    """The signed URL + A2A secret are server-side only; the run-create response
    exposes neither."""
    client = _client()
    resp = client.post("/api/v1/bundles/bundle_demo/gitpilot/runs", json={"task_id": "T"})
    raw = resp.text.lower()
    assert "token=" not in raw  # signed download token never surfaced
    assert "x-a2a-secret" not in raw
    assert "a2a" not in raw


def test_payload_signs_url_and_forces_forbidden_control_files():
    """Unit: the server-side payload carries a signed bundle URL and always
    forbids the Matrix control files, even if a caller allowed them."""
    service = GitPilotRunService()
    payload = service._payload(
        "bundle_demo",
        GitPilotRunRequest(task_id="T", allowed_files=["**", "MATRIX_STANDARDS.lock"]),
    )
    assert "token=" in payload["bundle_url"] and "expires=" in payload["bundle_url"]  # signed
    assert "/bundles/bundle_demo/download" in payload["bundle_url"]
    for control in MATRIX_CONTROL_FILES:
        assert control in payload["forbidden_files"]
