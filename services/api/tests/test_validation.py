from fastapi.testclient import TestClient

from app.main import app


def test_validation_placeholder():
    client = TestClient(app)
    response = client.post("/api/v1/validation/reports")
    assert response.status_code == 200
    assert response.json()["status"] == "not-run"
