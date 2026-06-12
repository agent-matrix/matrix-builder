from fastapi.testclient import TestClient

from app.main import app


def test_parse_idea():
    client = TestClient(app)
    response = client.post(
        "/api/v1/ideas/parse",
        json={"idea": "Build a GitHub repo intelligence agent", "build_type": "agent", "goal": "portfolio", "preferred_coder": "gitpilot"},
    )
    assert response.status_code == 200
    assert response.json()["preferred_coder"] == "gitpilot"
