"""Passwordless email sign-in (magic link) — token round-trip + endpoints (no real email)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import app.api.auth as auth_api
from app.core.auth import verify_token
from app.core.config import get_settings
from app.main import app


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("MB_JWT_SECRET", "test-secret-at-least-32-bytes-long-xxxxx")
    monkeypatch.setenv("PUBLIC_APP_URL", "https://builder.matrixhub.io")
    monkeypatch.delenv("RESEND_API_KEY", raising=False)  # dev mode: link is logged, not sent
    get_settings.cache_clear()
    sent: list[tuple[str, str]] = []
    monkeypatch.setattr(auth_api, "send_magic_link", lambda email, link, settings=None: sent.append((email, link)) or True)
    c = TestClient(app)
    c.sent = sent  # type: ignore[attr-defined]
    yield c
    get_settings.cache_clear()


def test_request_then_verify_mints_session(client):
    r = client.post("/api/v1/auth/email/request", json={"email": "User@Example.com"})
    assert r.status_code == 200 and r.json()["sent"] is True
    # Capture the token from the link our (patched) sender received.
    _, link = client.sent[-1]  # type: ignore[attr-defined]
    assert link.startswith("https://builder.matrixhub.io/auth/verify?token=")
    token = link.split("token=", 1)[1]
    v = client.post("/api/v1/auth/email/verify", json={"token": token})
    assert v.status_code == 200, v.text
    body = v.json()
    assert body["user"]["email"] == "user@example.com"
    claims = verify_token(body["access_token"])
    assert claims["sub"] == "email:user@example.com"


def test_invalid_email_rejected(client):
    assert client.post("/api/v1/auth/email/request", json={"email": "nope"}).status_code == 422


def test_bad_token_rejected(client):
    assert client.post("/api/v1/auth/email/verify", json={"token": "garbage"}).status_code == 401


def test_session_token_is_not_accepted_as_magic_link(client):
    # A normal session JWT must not be reusable as a magic-link (purpose claim differs).
    from app.core.google_auth import mint_session_jwt

    tok, _ = mint_session_jwt("email:user@example.com", email="user@example.com")
    assert client.post("/api/v1/auth/email/verify", json={"token": tok}).status_code == 401
