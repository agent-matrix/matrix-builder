from fastapi.testclient import TestClient

from app.main import app


def test_matrixhub_dry_run_accepts_approved_bundle():
    client = TestClient(app)
    response = client.post("/api/v1/publications/matrixhub/bundle_demo", json={"dry_run": True})
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is True
    assert body["status"] == "accepted"
    assert body["validation_status"] == "approved"
    assert body["trust_status"] == "dry-run"


def test_bundle_publish_endpoint_uses_same_matrixhub_gate():
    client = TestClient(app)
    response = client.post("/api/v1/bundles/bundle_demo/publish-to-matrixhub", json={"dry_run": True})
    assert response.status_code == 200
    body = response.json()
    assert body["accepted"] is True
    assert body["required_artifacts"]
