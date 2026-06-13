"""Traditional email+password auth: signup → activate → login, reset, and Google."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import app.api.auth as auth_api
from app.core import account_tokens as tok
from app.core.accounts import reset_memory_store
from app.core.auth import verify_token
from app.core.config import get_settings
from app.main import app

EMAIL = "user@example.com"
PW = "sup3r-secret-pw"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("MB_JWT_SECRET", "test-secret-at-least-32-bytes-long-xxxxx")
    monkeypatch.delenv("DATABASE_URL", raising=False)   # in-memory account store
    monkeypatch.delenv("RESEND_API_KEY", raising=False)  # dev mode: send_email returns True
    get_settings.cache_clear()
    reset_memory_store()
    yield TestClient(app)
    get_settings.cache_clear()
    reset_memory_store()


def test_signup_requires_activation_then_login_works(client):
    assert client.post("/api/v1/auth/signup", json={"email": EMAIL, "password": PW}).status_code == 202
    # Cannot log in until activated.
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PW}).status_code == 403
    # Activate with a (stateless) activation token, then we're signed in.
    act = client.post("/api/v1/auth/activate", json={"token": tok.make_token(EMAIL, tok.ACTIVATE)})
    assert act.status_code == 200, act.text
    assert verify_token(act.json()["access_token"])["sub"].startswith("account:")
    # Now login succeeds.
    login = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PW})
    assert login.status_code == 200 and login.json()["user"]["email"] == EMAIL


def test_login_rejects_bad_credentials(client):
    client.post("/api/v1/auth/signup", json={"email": EMAIL, "password": PW})
    client.post("/api/v1/auth/activate", json={"token": tok.make_token(EMAIL, tok.ACTIVATE)})
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": "wrong-password"}).status_code == 401
    assert client.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": PW}).status_code == 401


def test_duplicate_active_signup_conflicts(client):
    client.post("/api/v1/auth/signup", json={"email": EMAIL, "password": PW})
    client.post("/api/v1/auth/activate", json={"token": tok.make_token(EMAIL, tok.ACTIVATE)})
    assert client.post("/api/v1/auth/signup", json={"email": EMAIL, "password": PW}).status_code == 409


def test_password_reset_sets_new_password(client):
    client.post("/api/v1/auth/signup", json={"email": EMAIL, "password": PW})
    client.post("/api/v1/auth/activate", json={"token": tok.make_token(EMAIL, tok.ACTIVATE)})
    assert client.post("/api/v1/auth/password/forgot", json={"email": EMAIL}).json()["sent"] is True
    r = client.post("/api/v1/auth/password/reset", json={"token": tok.make_token(EMAIL, tok.RESET), "password": "new-password-123"})
    assert r.status_code == 200
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": "new-password-123"}).status_code == 200
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PW}).status_code == 401


def test_weak_password_and_bad_email_rejected(client):
    assert client.post("/api/v1/auth/signup", json={"email": EMAIL, "password": "short"}).status_code == 422
    assert client.post("/api/v1/auth/signup", json={"email": "nope", "password": PW}).status_code == 422


def test_wrong_purpose_token_rejected(client):
    # A reset token must not activate, and vice-versa.
    assert client.post("/api/v1/auth/activate", json={"token": tok.make_token(EMAIL, tok.RESET)}).status_code == 401


def test_signup_does_not_502_when_email_fails(client, monkeypatch):
    # A mail outage must not dead-end signup: the account is created, response is 202.
    monkeypatch.setattr(auth_api, "send_email", lambda to, subject, html, settings=None: False)
    r = client.post("/api/v1/auth/signup", json={"email": EMAIL, "password": PW})
    assert r.status_code == 202
    assert r.json()["email_sent"] is False
    # The account still exists and activates with a valid token.
    assert client.post("/api/v1/auth/activate", json={"token": tok.make_token(EMAIL, tok.ACTIVATE)}).status_code == 200


def test_delete_account_removes_login(client):
    client.post("/api/v1/auth/signup", json={"email": EMAIL, "password": PW})
    act = client.post("/api/v1/auth/activate", json={"token": tok.make_token(EMAIL, tok.ACTIVATE)})
    token = act.json()["access_token"]
    # Deleting requires authentication.
    assert client.delete("/api/v1/auth/account").status_code == 401
    r = client.delete("/api/v1/auth/account", headers={"authorization": f"Bearer {token}"})
    assert r.status_code == 200 and r.json()["deleted"] is True
    # The account is gone — login no longer works, and the email is free to re-register.
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PW}).status_code == 401
    assert client.post("/api/v1/auth/signup", json={"email": EMAIL, "password": PW}).status_code == 202


def test_change_password(client):
    client.post("/api/v1/auth/signup", json={"email": EMAIL, "password": PW})
    act = client.post("/api/v1/auth/activate", json={"token": tok.make_token(EMAIL, tok.ACTIVATE)})
    auth = {"authorization": f"Bearer {act.json()['access_token']}"}
    # wrong current password is rejected
    assert client.post("/api/v1/auth/password/change", headers=auth, json={"current_password": "nope-nope-nope", "new_password": "brand-new-pw-1"}).status_code == 401
    # correct current password succeeds
    assert client.post("/api/v1/auth/password/change", headers=auth, json={"current_password": PW, "new_password": "brand-new-pw-1"}).status_code == 200
    # new works, old doesn't
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": "brand-new-pw-1"}).status_code == 200
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PW}).status_code == 401
    # unauthenticated change is rejected
    assert client.post("/api/v1/auth/password/change", json={"current_password": PW, "new_password": "x"}).status_code == 401


def test_google_creates_active_account(client, monkeypatch):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    get_settings.cache_clear()
    monkeypatch.setattr(auth_api, "verify_google_id_token",
                        lambda credential, client_id: {"email": "g@example.com", "name": "G User", "sub": "123"})
    r = client.post("/api/v1/auth/google", json={"credential": "x"})
    assert r.status_code == 200 and r.json()["user"]["email"] == "g@example.com"
    # A Google user can't log in with a password (none set).
    assert client.post("/api/v1/auth/login", json={"email": "g@example.com", "password": PW}).status_code == 401
