from fastapi.testclient import TestClient

from app.main import app


def test_get_bundle():
    client = TestClient(app)
    response = client.get("/api/v1/bundles/bundle_demo")
    assert response.status_code == 200
    body = response.json()
    assert body["bundle_id"] == "bundle_demo"
    assert any(file["path"] == "MATRIX_BLUEPRINT.yaml" for file in body["files"])


def test_generate_bundle_from_idea_request():
    client = TestClient(app)
    response = client.post(
        "/api/v1/bundles",
        json={
            "idea_request": {
                "idea": "Build an AI app that analyzes GitHub repositories",
                "build_type": "agent",
                "goal": "portfolio",
                "preferred_coder": "gitpilot",
            },
            "preferred_coder": "gitpilot",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["manifest_digest"].startswith("sha256:")
    assert "gitpilot" in body["prompts_available"]


def test_bundle_specific_prompt_endpoint():
    client = TestClient(app)
    response = client.get("/api/v1/bundles/bundle_demo/prompt/gitpilot")
    assert response.status_code == 200
    body = response.json()
    assert body["coder"] == "gitpilot"
    assert "Bundle ID: bundle_demo" in body["prompt"]


def test_bundle_validate_endpoint():
    client = TestClient(app)
    response = client.post("/api/v1/bundles/bundle_demo/validate")
    assert response.status_code == 200
    assert response.json()["bundle_id"] == "bundle_demo"
