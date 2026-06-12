from fastapi.testclient import TestClient

from app.main import app


def test_matrixhub_publication_placeholder():
    client = TestClient(app)
    response = client.post("/api/v1/publications/matrixhub")
    assert response.status_code == 200
    assert response.json()["accepted"] is False
