from __future__ import annotations

import zipfile

from fastapi.testclient import TestClient

from app.main import app


IDEA_PAYLOAD = {
    "idea_request": {
        "idea": "Build an AI app that analyzes GitHub repositories and writes a standards report",
        "build_type": "agent",
        "goal": "portfolio",
        "preferred_coder": "gitpilot",
    },
    "preferred_coder": "gitpilot",
}


def _create_bundle(client: TestClient) -> dict:
    response = client.post("/api/v1/bundles", json=IDEA_PAYLOAD)
    assert response.status_code == 200, response.text
    return response.json()


def test_bundle_generation_persists_manifest_tree_and_zip():
    client = TestClient(app)
    bundle = _create_bundle(client)
    bundle_id = bundle["bundle_id"]

    assert bundle["status"] in {"ready", "saved"}
    assert bundle["manifest_digest"].startswith("sha256:")
    assert bundle["zip_digest"].startswith("sha256:")
    assert bundle["zip_size_bytes"] > 0
    assert bundle["signed_download_url"]
    assert any(file["path"] == "MATRIX_BLUEPRINT.yaml" for file in bundle["files"])

    manifest = client.get(f"/api/v1/bundles/{bundle_id}/manifest")
    assert manifest.status_code == 200, manifest.text
    assert manifest.json()["zip_digest"] == bundle["zip_digest"]

    tree = client.get(f"/api/v1/bundles/{bundle_id}/tree")
    assert tree.status_code == 200
    assert any(node["path"] == "coder-prompts/gitpilot.md" for node in tree.json())

    download = client.get(f"/api/v1/bundles/{bundle_id}/download")
    assert download.status_code == 200, download.text
    assert download.headers["content-type"] == "application/zip"
    assert download.content.startswith(b"PK")

    zip_path = client.app.dependency_overrides  # keeps the linter aware this is a TestClient path
    assert zip_path == {}


def test_downloaded_zip_contains_matrix_control_contract():
    client = TestClient(app)
    bundle = _create_bundle(client)
    response = client.get(f"/api/v1/bundles/{bundle['bundle_id']}/download")
    assert response.status_code == 200

    tmp_path = __import__("tempfile").NamedTemporaryFile(delete=False, suffix=".zip").name
    with open(tmp_path, "wb") as handle:
        handle.write(response.content)
    with zipfile.ZipFile(tmp_path) as archive:
        names = set(archive.namelist())
    assert "README.md" in names
    assert "MATRIX_BLUEPRINT.yaml" in names
    assert "MATRIX_STANDARDS.lock" in names
    assert "MATRIX_ALLOWED_CHANGES.md" in names
    assert "coder-prompts/gitpilot.md" in names


def test_signed_url_and_save_flow():
    client = TestClient(app)
    bundle = _create_bundle(client)
    bundle_id = bundle["bundle_id"]

    signed = client.post(f"/api/v1/bundles/{bundle_id}/signed-url")
    assert signed.status_code == 200
    assert f"/bundles/{bundle_id}/download" in signed.json()["url"]

    saved = client.post(
        f"/api/v1/bundles/{bundle_id}/save",
        json={"account_email": "dev@example.com", "label": "portfolio demo"},
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["saved"] is True
    refreshed = client.get(f"/api/v1/bundles/{bundle_id}")
    assert refreshed.json()["persisted"] is True


def test_guest_quota_and_cleanup_endpoint_exist():
    client = TestClient(app)
    quota = client.get("/api/v1/bundles/quota/guest")
    assert quota.status_code == 200
    assert quota.json()["limit"] >= 1

    cleanup = client.post("/api/v1/bundles/cleanup/expired")
    assert cleanup.status_code == 200
    assert "deleted_count" in cleanup.json()
