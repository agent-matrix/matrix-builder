"""Security & guardrail hardening matrix (Batch 9).

Negative tests: minimal/no-secret payload, short-TTL signed URLs, expired and
tampered URLs rejected, A2A required in prod, self-approval blocked, and a
secret-leak guard.
"""

from __future__ import annotations

import dataclasses

from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.schemas.gitpilot import GitPilotRepairRequest, GitPilotRunRequest
from app.services import gitpilot_run_service as svc
from app.services.gitpilot_run_service import GitPilotError, GitPilotRunService, commit_gate
from app.services.signed_url_service import SignedUrlService
from app.utils.time import utc_now


def _client() -> TestClient:
    return TestClient(app)


# -- short-TTL signed URLs -----------------------------------------------------


def test_payload_uses_short_ttl():
    service = GitPilotRunService()
    payload = service._payload("bundle_demo", GitPilotRunRequest(task_id="T"))
    # Signed URL expiry is the short GitPilot run TTL, not the 2-day bundle TTL.
    ttl = get_settings().gitpilot_run_ttl_seconds
    assert ttl <= 3600
    expires = int(payload["bundle_url"].split("expires=")[1].split("&")[0])
    delta = expires - int(utc_now().timestamp())
    assert 0 < delta <= ttl + 5


# -- minimal / no-secret payload ----------------------------------------------


def test_payload_carries_only_contract_no_secrets():
    service = GitPilotRunService()
    payload = service._payload(
        "bundle_demo", GitPilotRunRequest(task_id="T", prompt="do it", allowed_files=["src/**"])
    )
    assert set(payload) == {
        "bundle_url",
        "project_name",
        "task_id",
        "prompt",
        "allowed_files",
        "forbidden_files",
        "validation_commands",
        "mode",
    }
    # No API keys / secrets / tokens-other-than-the-signed-url in the payload.
    blob = str(payload).lower()
    assert "api_key" not in blob and "secret" not in blob and "authorization" not in blob


# -- expired / tampered signed URLs -------------------------------------------


def test_signed_token_expired_and_tampered_rejected():
    signer = SignedUrlService()
    past = int(utc_now().timestamp()) - 10
    token = signer._token("bundle_demo", past)
    assert signer.verify_download_token("bundle_demo", past, token) is False  # expired

    fresh = signer.sign_download_url("bundle_demo", ttl_seconds=600)
    expires = int(fresh.url.split("expires=")[1].split("&")[0])
    good = fresh.url.split("token=")[1]
    assert signer.verify_download_token("bundle_demo", expires, good) is True
    tampered = ("x" if good[0] != "x" else "y") + good[1:]
    assert signer.verify_download_token("bundle_demo", expires, tampered) is False


def test_download_route_rejects_bad_signed_url_when_enforced(monkeypatch):
    enforced = dataclasses.replace(get_settings(), signed_url_enforce=True)
    monkeypatch.setattr("app.api.bundles.get_settings", lambda: enforced)
    client = _client()

    # Missing token -> 401.
    assert client.get("/api/v1/bundles/bundle_demo/download").status_code == 401
    # Tampered token -> 403.
    bad = client.get("/api/v1/bundles/bundle_demo/download?expires=9999999999&token=nope")
    assert bad.status_code == 403
    # Expired token (valid signature, past expiry) -> 403.
    past = int(utc_now().timestamp()) - 10
    tok = SignedUrlService()._token("bundle_demo", past)
    expd = client.get(f"/api/v1/bundles/bundle_demo/download?expires={past}&token={tok}")
    assert expd.status_code == 403


# -- A2A required in production live mode --------------------------------------


def test_live_mode_requires_a2a_secret_in_prod(monkeypatch):
    prod_live = dataclasses.replace(
        get_settings(), app_env="production", gitpilot_mode="live", gitpilot_a2a_secret=""
    )
    monkeypatch.setattr(svc, "get_settings", lambda: prod_live)
    service = GitPilotRunService()
    # Fail closed: no live call proceeds without the shared secret.
    try:
        service.create_run("bundle_demo", GitPilotRunRequest(task_id="T"))
        raise AssertionError("expected GitPilotError")
    except GitPilotError as exc:
        assert "A2A_SECRET" in str(exc)


# -- self-approval blocked -----------------------------------------------------


def test_no_gitpilot_run_status_can_commit():
    # Commit is unlocked ONLY by a Matrix "approved" verdict — never by any
    # GitPilot implementation state.
    for status in ("queued", "running", "completed", "blocked", "error", "needs_approval"):
        assert commit_gate(status).can_commit is False
    assert commit_gate("approved").can_commit is True


def test_completed_passing_run_is_not_committable_without_validation():
    client = _client()
    created = client.post("/api/v1/bundles/bundle_demo/gitpilot/runs", json={"task_id": "T"})
    run_id = created.json()["run_id"]
    status = client.get(f"/api/v1/gitpilot/runs/{run_id}").json()
    assert status["status"] == "completed" and status["test_status"] == "passed"
    # The run status carries no commit authority; only the validate endpoint does.
    assert "gate" not in status and "can_commit" not in status


# -- secret-leak guard ---------------------------------------------------------


def test_secret_never_leaks_through_run_or_repair(monkeypatch):
    secret = "supersecret-a2a-value"
    with_secret = dataclasses.replace(get_settings(), gitpilot_a2a_secret=secret)
    monkeypatch.setattr(svc, "get_settings", lambda: with_secret)
    service = GitPilotRunService()

    created = service.create_run("bundle_demo", GitPilotRunRequest(task_id="T"))
    child = service.repair_run(created.run_id, GitPilotRepairRequest(repair_prompt="x"))
    status = service.get_run(created.run_id)
    for model in (created, child, status):
        assert secret not in model.model_dump_json()
    # The signed download token is never surfaced to the client either.
    assert "token=" not in created.model_dump_json()
