from fastapi.testclient import TestClient

from app.main import app


def test_blueprint_candidates():
    client = TestClient(app)
    response = client.post("/api/v1/blueprints/candidates", json={"idea": "Build an AI project"})
    assert response.status_code == 200
    body = response.json()
    assert len(body["candidates"]) == 3
    assert any(candidate["recommended"] for candidate in body["candidates"])


def test_generate_selected_blueprint():
    client = TestClient(app)
    candidates_response = client.post(
        "/api/v1/blueprints/candidates",
        json={"idea": "Build a document QA agent"},
    )
    candidate_id = candidates_response.json()["candidates"][1]["candidate_id"]
    response = client.post(
        "/api/v1/blueprints/generate",
        json={"idea_request": {"idea": "Build a document QA agent"}, "candidate_id": candidate_id},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["candidate_id"] == candidate_id
    assert "MATRIX_STANDARDS.lock" in body["required_files"]
