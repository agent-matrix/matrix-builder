from __future__ import annotations
from fastapi.testclient import TestClient
from app.core.config import get_settings
from app.core.rate_limits import InMemoryTokenBucket
from app.core.session import create_guest_session, verify_session_token
from app.main import create_app

def test_security_headers_and_request_id_present() -> None:
    response=TestClient(create_app()).get('/health')
    assert response.status_code==200
    assert response.headers['x-content-type-options']=='nosniff'
    assert response.headers['x-frame-options']=='DENY'
    assert response.headers['x-request-id'].startswith('req_')
def test_metrics_endpoint_exposes_prometheus_text() -> None:
    response=TestClient(create_app()).get('/metrics')
    assert response.status_code==200
    assert 'matrix_builder_info' in response.text
def test_guest_session_can_be_created_and_verified() -> None:
    settings=get_settings(); claims, token=create_guest_session(settings); verified=verify_session_token(token, settings)
    assert verified is not None and verified.session_id==claims.session_id and verified.plan=='guest'
def test_auth_session_endpoint_sets_cookie() -> None:
    response=TestClient(create_app()).post('/api/v1/auth/session')
    assert response.status_code==200
    assert response.json()['plan']=='guest'
    assert 'matrix_builder_session' in response.headers.get('set-cookie','')
def test_token_bucket_rejects_when_empty() -> None:
    bucket=InMemoryTokenBucket(requests_per_minute=1, burst=1)
    assert bucket.allow('client') is True
    assert bucket.allow('client') is False
