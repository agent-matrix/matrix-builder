from __future__ import annotations

import zipfile

from fastapi.testclient import TestClient

from app.main import app
from app.schemas.common import CoderId
from app.services.ai_coder_prompt_service import build_prompt_pack, build_prompt_response


IDEA_PAYLOAD = {
    "idea_request": {
        "idea": "Build an AI app that analyzes GitHub repositories and writes a standards report",
        "build_type": "agent",
        "goal": "portfolio",
        "preferred_coder": "gitpilot",
    },
    "preferred_coder": "gitpilot",
}


def test_every_ai_coder_prompt_is_controlled():
    for coder in CoderId:
        response = build_prompt_response("bundle_test", coder)
        assert response.coder == coder
        assert "AI coders are workers, not architects" in response.prompt
        assert "Implement `TASK-001` only" in response.prompt
        assert "Do not modify `MATRIX_BLUEPRINT.yaml`" in response.prompt
        assert "MATRIX_STATUS:" in response.prompt
        assert "MATRIX_BLUEPRINT.yaml" in response.contract_files
        assert response.allowed_files
        assert response.validation_commands


def test_prompt_pack_contains_all_supported_coders():
    pack = build_prompt_pack("bundle_test", "bp_test", default_coder="gitpilot")
    coders = {item.coder for item in pack.prompts}
    assert coders == set(CoderId)
    assert pack.default_coder == CoderId.GITPILOT
    assert all("worker" in item.content for item in pack.prompts)


def test_bundle_prompt_endpoint_returns_contract_fields():
    client = TestClient(app)
    created = client.post("/api/v1/bundles", json=IDEA_PAYLOAD)
    assert created.status_code == 200, created.text
    bundle_id = created.json()["bundle_id"]

    response = client.get(f"/api/v1/bundles/{bundle_id}/prompt/claude-code")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["coder"] == "claude-code"
    assert body["path"] == "coder-prompts/claude-code.md"
    assert body["allowed_files"]
    assert body["validation_commands"]
    assert "AI coders are workers, not architects" in body["prompt"]


def test_downloaded_zip_contains_full_prompt_pack_and_coder_prompts(tmp_path):
    client = TestClient(app)
    created = client.post("/api/v1/bundles", json=IDEA_PAYLOAD)
    assert created.status_code == 200, created.text
    bundle_id = created.json()["bundle_id"]
    downloaded = client.get(f"/api/v1/bundles/{bundle_id}/download")
    assert downloaded.status_code == 200, downloaded.text

    zip_file = tmp_path / "bundle.zip"
    zip_file.write_bytes(downloaded.content)
    with zipfile.ZipFile(zip_file) as archive:
        names = set(archive.namelist())
        gitpilot_prompt = archive.read("coder-prompts/gitpilot.md").decode("utf-8")
        prompt_pack = archive.read("coder-prompts/prompt-pack.json").decode("utf-8")

    assert "coder-prompts/claude-code.md" in names
    assert "coder-prompts/codex-chatgpt.md" in names
    assert "coder-prompts/cursor.md" in names
    assert "coder-prompts/gitpilot.md" in names
    assert "coder-prompts/ibm-bob.md" in names
    assert "coder-prompts/generic-ai-coder.md" in names
    assert "coder-prompts/prompt-pack.json" in names
    assert "Explorer may inspect the bundle" in gitpilot_prompt
    assert "AI coders are workers, not architects" in prompt_pack
