"""Batch C3 exit criteria: a running validation streams live, survives reconnects, and the
timeline reflects the terminal state without a refresh.

Exercised end-to-end over HTTP + WebSocket against a real RLS-enforced Postgres and an
authenticated Supabase JWT: enqueue an async run, watch the append-only event log fill, replay
the stream over the WebSocket (twice, from different cursors), and confirm the worker reached a
terminal commit/repair state.
"""

from __future__ import annotations

import os
import time
import uuid

import jwt
import pytest
from starlette.websockets import WebSocketDisconnect

USER_A = "11111111-1111-1111-1111-111111111111"
_SECRET = "dev-only-change-me"


def _token(sub: str) -> str:
    return jwt.encode(
        {"sub": sub, "aud": "authenticated", "exp": int(time.time()) + 3600},
        _SECRET,
        algorithm="HS256",
    )


def _auth(sub: str) -> dict[str, str]:
    # Unique rate-limit key per request (RLS still uses the JWT sub); avoids the shared app
    # singleton's per-user buckets accumulating across the session and spuriously 429-ing.
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

    with TestClient(app) as c:  # context manager runs startup -> starts the run worker
        yield c

    reset_engine_cache()
    if prev is None:
        os.environ.pop("DATABASE_URL", None)
    else:
        os.environ["DATABASE_URL"] = prev
    get_settings.cache_clear()


def _seed_ready_batch(client, *, goal: str = "Add the health endpoint") -> tuple[str, str]:
    """Create project -> version -> batch -> prompt pack; return (version_id, batch_id)."""
    p = client.post(
        "/api/v1/projects",
        json={"title": "Streaming Build", "slug": "streaming-build"},
        headers=_auth(USER_A),
    )
    project_id = p.json()["id"]
    v = client.post(
        "/api/v1/versions",
        json={"project_id": project_id, "version_label": "v1.0.0", "title": "Initial"},
        headers=_auth(USER_A),
    )
    version_id = v.json()["id"]
    b = client.post(
        "/api/v1/batches",
        json={"version_id": version_id, "goal_md": goal, "change_type": "add-feature"},
        headers=_auth(USER_A),
    )
    batch_id = b.json()["id"]
    client.post(
        f"/api/v1/batches/{batch_id}/prompt-pack",
        json={"coder": "claude-code"},
        headers=_auth(USER_A),
    )
    return version_id, batch_id


def _wait_terminal(client, run_id: str, tries: int = 200, delay: float = 0.05) -> list[dict]:
    for _ in range(tries):
        events = client.get(f"/api/v1/runs/{run_id}/events", headers=_auth(USER_A)).json()
        if any(e["event_type"] in ("run.completed", "run.failed") for e in events):
            return events
        time.sleep(delay)
    raise AssertionError(f"run {run_id} never reached a terminal event")


def _drain_ws(client, run_id: str, after: int = 0) -> list[dict]:
    events: list[dict] = []
    url = f"/api/v1/ws/runs/{run_id}?token={_token(USER_A)}&after={after}"
    with client.websocket_connect(url) as ws:
        try:
            while True:
                events.append(ws.receive_json())
        except WebSocketDisconnect:
            pass
    return events


def test_async_run_streams_and_reaches_committed_terminal(client) -> None:
    version_id, batch_id = _seed_ready_batch(client)

    # Enqueue an async run with a clean, in-scope change set -> worker should approve + commit.
    enq = client.post(
        f"/api/v1/batches/{batch_id}/runs",
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
    assert enq.status_code == 202, enq.text
    run_id = enq.json()["run_id"]
    assert enq.json()["status"] == "running"

    # The append-only log fills as the worker progresses.
    events = _wait_terminal(client, run_id)
    types = [e["event_type"] for e in events]
    assert types[0] == "run.enqueued"
    for expected in ("run.started", "artifacts.created", "commit.created", "run.completed"):
        assert expected in types, types
    # seq is strictly increasing and contiguous from 1.
    assert [e["seq"] for e in events] == list(range(1, len(events) + 1))

    # The run is now terminal: approved, with a commit.
    run = client.get(f"/api/v1/runs/{run_id}", headers=_auth(USER_A)).json()
    assert run["status"] == "approved"
    assert run["ui_label"] == "Passed"
    assert run["commit_id"]

    # A WebSocket connecting now replays the whole stream and closes on the terminal event:
    # this is exactly the "survives reconnects" path (catch up from the durable log).
    streamed = _drain_ws(client, run_id, after=0)
    s_types = [e["event_type"] for e in streamed]
    assert "commit.created" in s_types and s_types[-1] == "run.completed"

    # Reconnecting from a later cursor yields only the events after it (drop-and-replay).
    commit_seq = next(e["seq"] for e in events if e["event_type"] == "commit.created")
    resumed = _drain_ws(client, run_id, after=commit_seq)
    assert [e["event_type"] for e in resumed] == ["run.completed"]

    # Timeline reflects the terminal state without any refresh of the worker: the approved commit
    # is present.
    tl = client.get(f"/api/v1/versions/{version_id}/timeline", headers=_auth(USER_A)).json()
    commits = [e for e in tl["entries"] if e["kind"] == "commit"]
    assert commits and commits[-1]["status"] == "approved"
    assert commits[-1]["ui_label"] == "Passed"


def test_async_run_needs_repair_attaches_repair_suggestion(client) -> None:
    _, batch_id = _seed_ready_batch(client, goal="Touch a control file")

    # Editing a Matrix control file is a hard violation -> rejected, no commit, repair suggested.
    enq = client.post(
        f"/api/v1/batches/{batch_id}/runs",
        json={"changed_files": [{"path": "MATRIX_STANDARDS.lock", "change_type": "modified"}]},
        headers=_auth(USER_A),
    )
    run_id = enq.json()["run_id"]

    events = _wait_terminal(client, run_id)
    types = [e["event_type"] for e in events]
    assert "repair.suggested" in types
    assert "commit.created" not in types

    repair = next(e for e in events if e["event_type"] == "repair.suggested")
    assert repair["payload"]["repair_batch_id"]

    run = client.get(f"/api/v1/runs/{run_id}", headers=_auth(USER_A)).json()
    assert run["status"] == "rejected"
    assert run["commit_id"] is None

    # The suggested repair batch exists and is ready to implement.
    repair_batch_id = repair["payload"]["repair_batch_id"]
    rb = client.get(f"/api/v1/batches/{repair_batch_id}", headers=_auth(USER_A)).json()
    assert rb["change_type"] == "fix-issue"
    assert rb["status"] == "ready"


def test_run_events_require_auth(client) -> None:
    # No token on the WebSocket -> server rejects the connection.
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/api/v1/ws/runs/does-not-exist") as ws:
            ws.receive_json()
