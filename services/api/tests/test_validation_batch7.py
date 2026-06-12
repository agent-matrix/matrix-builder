from fastapi.testclient import TestClient

from app.main import app


def test_bundle_validation_can_approve_clean_patch():
    client = TestClient(app)
    response = client.post(
        "/api/v1/bundles/bundle_demo/validate",
        json={
            "bundle_id": "bundle_demo",
            "mode": "patch",
            "changed_files": [{"path": "frontend/app/page.tsx", "status": "modified"}],
            "dependency_changes": [],
            "artifacts": [],
            "metadata": {"source": "test"},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "approved"
    assert body["approved"] is True
    assert body["matrixhub_publishable"] is True


def test_bundle_validation_rejects_control_file_drift():
    client = TestClient(app)
    response = client.post(
        "/api/v1/validation/patch",
        json={
            "bundle_id": "bundle_demo",
            "mode": "patch",
            "changed_files": [{"path": "MATRIX_BLUEPRINT.yaml", "status": "modified"}],
            "dependency_changes": [],
            "artifacts": [],
            "metadata": {"source": "test"},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "rejected"
    assert any(item["rule_id"] == "RMD-103" for item in body["violations"])
    assert "AI coders are workers" in body["repair_prompt"]


def test_bundle_validation_needs_repair_for_unapproved_dependency():
    client = TestClient(app)
    response = client.post(
        "/api/v1/bundles/bundle_demo/validate",
        json={
            "bundle_id": "bundle_demo",
            "mode": "patch",
            "changed_files": [{"path": "backend/app/api/routes.py", "status": "modified"}],
            "dependency_changes": [
                {"ecosystem": "pip", "name": "dangerous-new-lib", "action": "added", "approved": False}
            ],
            "artifacts": [],
            "metadata": {},
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "needs-repair"
    assert any(item["rule_id"] == "RMD-105" for item in body["violations"])
