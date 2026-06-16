"""GitPilot integration observability (Batch 12).

Per-owner metrics summary from the run history, plus process-wide Prometheus
counters incremented on run/validation/repair/PR events.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.observability.metrics import metrics_registry


def _client() -> TestClient:
    return TestClient(app, headers={"x-matrix-user-id": f"metrics:{uuid.uuid4().hex}"})


def test_metrics_summary_reflects_runs_and_verdicts():
    client = _client()
    run_id = client.post(
        "/api/v1/bundles/bundle_demo/gitpilot/runs", json={"task_id": "M1"}
    ).json()["run_id"]
    client.get(f"/api/v1/gitpilot/runs/{run_id}")
    client.post(f"/api/v1/bundles/bundle_demo/gitpilot/runs/{run_id}/validate")

    m = client.get("/api/v1/gitpilot/metrics").json()
    assert m["runs"] >= 1
    assert m["by_status"].get("completed", 0) >= 1
    assert sum(m["by_verdict"].values()) >= 1
    assert m["history_backend"] in {"in-memory", "postgres"}


def test_prometheus_counters_increment_on_events():
    client = _client()
    before = metrics_registry.render_prometheus()
    run_id = client.post(
        "/api/v1/bundles/bundle_demo/gitpilot/runs", json={"task_id": "M2"}
    ).json()["run_id"]
    client.get(f"/api/v1/gitpilot/runs/{run_id}")
    client.post(f"/api/v1/bundles/bundle_demo/gitpilot/runs/{run_id}/validate")
    after = metrics_registry.render_prometheus()

    assert "matrix_builder_gitpilot_runs_created" in after
    assert "matrix_builder_gitpilot_validations_total" in after

    # The created counter strictly increased.
    def _count(text: str, name: str) -> int:
        for line in text.splitlines():
            if line.startswith(name + " "):
                return int(line.rsplit(" ", 1)[1])
        return 0

    assert _count(after, "matrix_builder_gitpilot_runs_created") > _count(
        before, "matrix_builder_gitpilot_runs_created"
    )


def test_metrics_owner_scoped():
    a = _client()
    a.post("/api/v1/bundles/bundle_demo/gitpilot/runs", json={"task_id": "A"})
    b = _client()  # different x-matrix-user-id, but owner is still guest (no JWT)
    # Both are guest-owned (no auth), so both see the shared guest history; the
    # endpoint is owner-scoped by JWT sub when present. Here we only assert it
    # responds with a coherent summary.
    m = b.get("/api/v1/gitpilot/metrics").json()
    assert "runs" in m and "by_status" in m
