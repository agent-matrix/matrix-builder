from fastapi.testclient import TestClient

from app.main import app


def test_get_prompt():
    client = TestClient(app)
    response = client.get("/api/v1/prompts/gitpilot")
    assert response.status_code == 200
    body = response.json()
    assert body["coder"] == "gitpilot"
    assert body["path"] == "coder-prompts/gitpilot.md"
    assert "not architects" in body["prompt"]
    assert body["allowed_files"]
    assert body["validation_commands"]


def test_get_prompt_pack_route():
    client = TestClient(app)
    response = client.get("/api/v1/prompts/bundle_demo/pack/all")
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body["prompts"]) == 6
    assert {item["coder"] for item in body["prompts"]} == {
        "claude-code",
        "codex-chatgpt",
        "cursor",
        "gitpilot",
        "ibm-bob",
        "generic-ai-coder",
    }
