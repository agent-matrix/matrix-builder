from fastapi.testclient import TestClient

from app.main import app


def test_standards_current():
    client = TestClient(app)
    response = client.get("/api/v1/standards/current")
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "matrix-definitions"
    assert body["status"] == "preview-pack-loaded"
    assert body["digest"].startswith("sha256:")
    assert body["rules_count"] >= 161
