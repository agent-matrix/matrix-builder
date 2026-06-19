"""batch-02 — the Blueprint Details proxy endpoints (fail-open, never 500)."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
IDEA = "Build a Phaser/Vite platformer game on GitHub Pages"


def test_details_endpoint_returns_dashboard():
    r = client.get("/api/v1/blueprints/standard/details", params={"idea": IDEA})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["candidate_id"] == "standard"
    for key in ("overview", "architecture", "batches", "file_plan", "matrix_rules"):
        assert body[key]
    assert all(b["allowed_files"] and b["acceptance_criteria"] for b in body["batches"])


def test_chat_endpoint_refines():
    r = client.post("/api/v1/blueprints/standard/chat", json={"idea": IDEA, "message": "add a boss level"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["reply"]
    assert body["details"]["batches"][-1]["name"]  # a batch exists


def test_save_endpoint_echoes_details():
    details = client.get("/api/v1/blueprints/minimal/details", params={"idea": IDEA}).json()
    r = client.post("/api/v1/blueprints/minimal/save", json={"idea": IDEA, "details": details})
    assert r.status_code == 200, r.text
    assert r.json()["candidate_id"] == "minimal"


def test_designer_candidates_returns_three_tiers():
    r = client.get("/api/v1/blueprints/designer-candidates", params={"idea": IDEA})
    assert r.status_code == 200, r.text
    cands = r.json()["candidates"]
    assert [c["id"] for c in cands] == ["minimal", "standard", "production"]
    assert any(c["recommended"] for c in cands)
    assert all(c["file_count"] >= 1 and c["stack"] for c in cands)


def test_openapi_lists_new_routes():
    paths = app.openapi()["paths"]
    assert "/api/v1/blueprints/designer-candidates" in paths
    assert "/api/v1/blueprints/{candidate_id}/details" in paths
    assert "/api/v1/blueprints/{candidate_id}/chat" in paths
    assert "/api/v1/blueprints/{candidate_id}/save" in paths
    assert "/api/v1/blueprints/{candidate_id}/saved" in paths


# --- batch-10 — persistence (save → saved restores the same blueprint + chat) ----------
def test_save_then_saved_restores_build():
    details = client.get("/api/v1/blueprints/standard/details", params={"idea": IDEA}).json()
    details["chat_history"] = [{"id": "u1", "role": "user", "content": "add a boss level", "timestamp": ""}]
    save = client.post("/api/v1/blueprints/standard/save",
                       json={"idea": IDEA, "build_id": "build_xyz", "details": details})
    assert save.status_code == 200, save.text
    got = client.get("/api/v1/blueprints/standard/saved", params={"build_id": "build_xyz"})
    assert got.status_code == 200, got.text
    body = got.json()
    assert body["found"] is True
    assert body["details"]["candidate_id"] == "standard"
    assert body["details"]["chat_history"][0]["content"] == "add a boss level"


def test_saved_unknown_build_is_not_found():
    got = client.get("/api/v1/blueprints/standard/saved", params={"build_id": "nope_404"})
    assert got.status_code == 200
    assert got.json()["found"] is False


def test_store_is_owner_isolated():
    from app.services.design_bundle_store import DesignBundleStore
    s = DesignBundleStore()
    s.save("alice", "b1", "standard", "idea", {"candidate_id": "standard"}, [])
    assert s.get("alice", "b1", "standard") is not None
    assert s.get("bob", "b1", "standard") is None  # isolation (RLS in DB; key in memory)
