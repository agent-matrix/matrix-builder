"""Sign in with Google → MB session JWT (no network: the JWKS key is monkeypatched)."""
from __future__ import annotations

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

import app.core.google_auth as google_auth
from app.core.auth import verify_token
from app.core.config import get_settings
from app.main import app

CLIENT_ID = "test-client-id.apps.googleusercontent.com"


@pytest.fixture
def rsa_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def _google_token(key, *, aud=CLIENT_ID, iss="https://accounts.google.com", sub="1234567890", **extra):
    now = int(time.time())
    payload = {"sub": sub, "aud": aud, "iss": iss, "iat": now, "exp": now + 3600,
               "email": "user@example.com", "email_verified": True, "name": "Test User", **extra}
    return jwt.encode(payload, key, algorithm="RS256")


@pytest.fixture
def client(monkeypatch, rsa_key):
    monkeypatch.setenv("GOOGLE_CLIENT_ID", CLIENT_ID)
    monkeypatch.setenv("MB_JWT_SECRET", "test-secret-at-least-32-bytes-long-xxxxx")
    get_settings.cache_clear()
    # Avoid any network: resolve the signing key to our local public key.
    monkeypatch.setattr(google_auth, "_signing_key", lambda credential: rsa_key.public_key())
    yield TestClient(app)
    get_settings.cache_clear()


def test_google_login_mints_a_valid_session_jwt(client, rsa_key):
    resp = client.post("/api/v1/auth/google", json={"credential": _google_token(rsa_key)})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["user"]["email"] == "user@example.com"
    # The minted token must be accepted by the same verifier the rest of the API uses.
    claims = verify_token(body["access_token"])
    assert claims["sub"] == "google:1234567890"
    assert claims["email"] == "user@example.com"


def test_rejects_wrong_audience(client, rsa_key):
    bad = _google_token(rsa_key, aud="someone-else.apps.googleusercontent.com")
    assert client.post("/api/v1/auth/google", json={"credential": bad}).status_code == 401


def test_rejects_bad_issuer(client, rsa_key):
    bad = _google_token(rsa_key, iss="https://evil.example.com")
    assert client.post("/api/v1/auth/google", json={"credential": bad}).status_code == 401


def test_rejects_unverified_email(client, rsa_key):
    bad = _google_token(rsa_key, email_verified=False)
    assert client.post("/api/v1/auth/google", json={"credential": bad}).status_code == 401


def test_503_when_not_configured(monkeypatch, rsa_key):
    monkeypatch.delenv("GOOGLE_CLIENT_ID", raising=False)
    get_settings.cache_clear()
    monkeypatch.setattr(google_auth, "_signing_key", lambda credential: rsa_key.public_key())
    c = TestClient(app)
    assert c.post("/api/v1/auth/google", json={"credential": _google_token(rsa_key)}).status_code == 503
    get_settings.cache_clear()
