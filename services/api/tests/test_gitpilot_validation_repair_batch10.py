"""GitPilot validation gate + repair loop (Batches 7 & 8).

Mock mode (default): the run service returns deterministic runs; validation runs
against the real bundle contract via the drift detector.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.common import ValidationStatus
from app.services.gitpilot_run_service import commit_gate


def _client() -> TestClient:
    return TestClient(app)


def _new_run(client: TestClient) -> str:
    created = client.post("/api/v1/bundles/bundle_demo/gitpilot/runs", json={"task_id": "TASK-1"})
    return created.json()["run_id"]


# -- Batch 7: the gate is a pure function of the Matrix verdict ----------------


def test_commit_gate_maps_three_verdicts():
    approved = commit_gate(ValidationStatus.APPROVED)
    assert approved.can_commit and not approved.can_repair and not approved.blocked

    needs = commit_gate(ValidationStatus.NEEDS_REPAIR)
    assert needs.can_repair and not needs.can_commit and not needs.blocked

    rejected = commit_gate(ValidationStatus.REJECTED)
    assert rejected.blocked and not rejected.can_commit and not rejected.can_repair


def test_validate_run_returns_report_and_gate():
    client = _client()
    run_id = _new_run(client)
    resp = client.post(f"/api/v1/bundles/bundle_demo/gitpilot/runs/{run_id}/validate")
    assert resp.status_code == 200
    body = resp.json()
    assert body["run_id"] == run_id
    assert body["report"]["status"] in {"approved", "needs-repair", "rejected", "not-run"}
    # The gate matches the report verdict — never GitPilot's own status.
    assert body["gate"]["status"] == body["report"]["status"]
    assert body["gate"]["can_commit"] == (body["report"]["status"] == "approved")


def test_commit_gate_blocks_when_control_file_touched(monkeypatch):
    """A diff that touches a Matrix control file must NOT unlock the commit —
    commit stays reachable only via a Matrix-approved verdict."""
    client = _client()
    run_id = _new_run(client)

    # Force the synced run to report a forbidden change.
    from app.services import gitpilot_run_service as svc
    from app.schemas.gitpilot import GitPilotRunStatusResponse

    def fake_get_run(self, rid):  # noqa: ANN001
        return GitPilotRunStatusResponse(
            run_id=rid,
            status="completed",
            test_status="passed",
            changed_files=["MATRIX_STANDARDS.lock"],
        )

    monkeypatch.setattr(svc.GitPilotRunService, "get_run", fake_get_run)
    resp = client.post(f"/api/v1/bundles/bundle_demo/gitpilot/runs/{run_id}/validate")
    body = resp.json()
    assert body["report"]["status"] != "approved"
    assert body["gate"]["can_commit"] is False


# -- Batch 8: repair loop ------------------------------------------------------


def test_repair_dispatch_returns_new_queued_run():
    client = _client()
    run_id = _new_run(client)
    resp = client.post(
        f"/api/v1/bundles/bundle_demo/gitpilot/runs/{run_id}/repair",
        json={
            "validation_findings": ["file outside allowed_paths"],
            "repair_prompt": "move the change into tests/",
            "allowed_files": ["tests/**"],
            "forbidden_files": [],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "queued"
    assert body["run_id"].startswith("gp-run-")
    assert body["run_id"] != run_id  # a child run


def test_repair_then_revalidate_round_trip():
    """needs-repair -> repair -> re-validate stays inside the loop."""
    client = _client()
    run_id = _new_run(client)
    repaired = client.post(
        f"/api/v1/bundles/bundle_demo/gitpilot/runs/{run_id}/repair",
        json={"repair_prompt": "fix it"},
    )
    child = repaired.json()["run_id"]
    revalidated = client.post(f"/api/v1/bundles/bundle_demo/gitpilot/runs/{child}/validate")
    assert revalidated.status_code == 200
    assert "gate" in revalidated.json()
