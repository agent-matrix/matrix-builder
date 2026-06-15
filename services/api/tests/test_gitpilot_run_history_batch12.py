"""GitPilot run history persistence (Batch 10).

Runs against the in-memory store (no DATABASE_URL). Records runs on create /
sync / validate / repair, isolates per owner, and exposes the history endpoint.
"""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.services.gitpilot_run_store import get_run_store


def _client() -> TestClient:
    # Unique x-matrix-user-id per client keys the rate limiter so these tests
    # don't drain the shared IP bucket and spuriously 429 later tests. It does
    # not affect the persisted owner (that comes from the JWT, absent here =
    # guest), so the history stays guest-scoped as intended.
    return TestClient(app, headers={"x-matrix-user-id": f"hist:{uuid.uuid4().hex}"})


def test_history_backend_is_in_memory_without_db():
    assert get_run_store().backend == "in-memory"


def test_run_is_recorded_and_listed():
    client = _client()
    created = client.post("/api/v1/bundles/bundle_demo/gitpilot/runs", json={"task_id": "TASK-H1"})
    run_id = created.json()["run_id"]

    hist = client.get("/api/v1/gitpilot/runs").json()
    assert hist["backend"] == "in-memory"
    ids = [r["id"] for r in hist["runs"]]
    assert run_id in ids
    rec = next(r for r in hist["runs"] if r["id"] == run_id)
    assert rec["bundle_id"] == "bundle_demo"
    assert rec["task_id"] == "TASK-H1"
    assert rec["source"] == "cloud"
    # Owner is never leaked in the public record.
    assert "owner_id" not in rec


def test_status_and_validation_update_the_record():
    client = _client()
    run_id = client.post(
        "/api/v1/bundles/bundle_demo/gitpilot/runs", json={"task_id": "TASK-H2"}
    ).json()["run_id"]

    # Polling the run syncs status into history.
    client.get(f"/api/v1/gitpilot/runs/{run_id}")
    # Validating records the Matrix verdict + gate.
    client.post(f"/api/v1/bundles/bundle_demo/gitpilot/runs/{run_id}/validate")

    rec = next(r for r in client.get("/api/v1/gitpilot/runs").json()["runs"] if r["id"] == run_id)
    assert rec["status"] == "completed"
    assert rec["validation_status"] in {"approved", "needs-repair", "rejected"}
    assert rec["can_commit"] == (rec["validation_status"] == "approved")


def test_repair_child_recorded_with_parent():
    client = _client()
    parent = client.post(
        "/api/v1/bundles/bundle_demo/gitpilot/runs", json={"task_id": "TASK-H3"}
    ).json()["run_id"]
    child = client.post(
        f"/api/v1/bundles/bundle_demo/gitpilot/runs/{parent}/repair", json={"repair_prompt": "x"}
    ).json()["run_id"]

    runs = client.get("/api/v1/gitpilot/runs").json()["runs"]
    rec = next(r for r in runs if r["id"] == child)
    assert rec["parent_run_id"] == parent


def test_history_filters_by_bundle():
    client = _client()
    r1 = client.post("/api/v1/bundles/bundle_demo/gitpilot/runs", json={"task_id": "A"}).json()[
        "run_id"
    ]
    r2 = client.post("/api/v1/bundles/other_bundle/gitpilot/runs", json={"task_id": "B"}).json()[
        "run_id"
    ]
    only_demo = client.get("/api/v1/gitpilot/runs", params={"bundle_id": "bundle_demo"}).json()[
        "runs"
    ]
    ids = [r["id"] for r in only_demo]
    assert r1 in ids and r2 not in ids


def test_store_isolates_by_owner():
    store = get_run_store()
    store.record(run_id="gp-run-alice", owner_id="alice", bundle_id="b")
    store.record(run_id="gp-run-bob", owner_id="bob", bundle_id="b")
    alice_ids = [r["id"] for r in store.list("alice")]
    assert "gp-run-alice" in alice_ids and "gp-run-bob" not in alice_ids
    assert store.get("gp-run-bob", "alice") is None
    assert store.get("gp-run-bob", "bob") is not None
