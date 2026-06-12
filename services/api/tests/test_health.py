from fastapi.testclient import TestClient

from app.main import app


def test_health_endpoint():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_api_health_endpoint():
    client = TestClient(app)
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["service"] == "matrix-builder"


def test_ready_endpoint_exposes_adapter_boundaries():
    client = TestClient(app)
    response = client.get("/api/v1/ready")
    assert response.status_code == 200
    body = response.json()
    assert body["ready"] is True
    assert body["agent_generator"]["engine"]
    assert body["matrix_definitions"]["source"] == "matrix-definitions"
    assert "agent-generator does generation" in body["rule"]
