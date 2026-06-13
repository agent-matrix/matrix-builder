from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache


def _bool(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).strip().lower() in {"1", "true", "yes", "on"}

@dataclass(frozen=True)
class Settings:
    app_name: str = "matrix-builder"
    app_env: str = "development"
    app_version: str = "0.8.0-batch.8"
    api_cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    allowed_hosts_raw: str = "localhost,127.0.0.1,0.0.0.0,testserver"
    enable_security_headers: bool = True
    x_frame_options: str = "DENY"
    enable_hsts: bool = False
    hsts_max_age_seconds: int = 31536000
    content_security_policy: str = "default-src 'self'; frame-ancestors 'none'; base-uri 'self'"
    rate_limit_enabled: bool = True
    rate_limit_requests_per_minute: int = 120
    rate_limit_burst: int = 40
    rate_limit_bundle_requests_per_hour: int = 20
    session_cookie_name: str = "matrix_builder_session"
    session_ttl_seconds: int = 86400
    session_signing_key: str = "dev-only-session-key-change-before-production"
    agent_generator_mode: str = "mock"
    matrix_definitions_mode: str = "mock"
    matrixhub_mode: str = "dry-run"
    signed_url_ttl_seconds: int = 172800
    signed_url_secret: str = "dev-only-change-me"
    guest_bundles_per_day: int = 3
    free_bundles_per_month: int = 20
    guest_bundle_ttl_seconds: int = 172800
    free_bundle_ttl_seconds: int = 2592000
    storage_backend: str = "local"
    storage_root: str = ".local/matrix-builder-storage"
    public_api_base_url: str = "http://localhost:8000/api/v1"
    # --- Persistence (Batch C1): Supabase Postgres + Auth + Storage --------------
    # DSN is supplied via env only; empty string keeps the in-memory repositories.
    database_url: str = ""
    db_pool_size: int = 5
    db_max_overflow: int = 2
    supabase_jwt_secret: str = "dev-only-change-me"
    supabase_jwt_algorithm: str = "HS256"
    supabase_jwt_audience: str = "authenticated"
    supabase_storage_bucket: str = "matrix-bundles"
    google_client_id: str = ""
    resend_api_key: str = ""
    email_from: str = "Matrix Builder <onboarding@resend.dev>"
    public_app_url: str = "https://builder.matrixhub.io"
    email_link_ttl_seconds: int = 900
    metrics_enabled: bool = True
    otel_enabled: bool = False
    otel_service_name: str = "matrix-builder-api"
    otel_exporter_otlp_endpoint: str = "http://otel-collector:4317"
    audit_log_path: str = ".local/audit/audit-events.jsonl"
    json_logs: bool = True
    log_level: str = "INFO"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(',') if o.strip()]
    @property
    def allowed_hosts(self) -> list[str]:
        hosts=[h.strip() for h in self.allowed_hosts_raw.split(',') if h.strip()]
        return hosts or ["localhost", "127.0.0.1", "testserver"]
    @property
    def production(self) -> bool:
        return self.app_env.lower()=="production"

@lru_cache
def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv('APP_NAME','matrix-builder'), app_env=os.getenv('APP_ENV','development'), app_version=os.getenv('APP_VERSION','0.8.0-batch.8'),
        api_cors_origins=os.getenv('API_CORS_ORIGINS','http://localhost:3000,http://127.0.0.1:3000'), allowed_hosts_raw=os.getenv('ALLOWED_HOSTS','localhost,127.0.0.1,0.0.0.0,testserver'),
        enable_security_headers=_bool('ENABLE_SECURITY_HEADERS','true'), x_frame_options=os.getenv('X_FRAME_OPTIONS','DENY'), enable_hsts=_bool('ENABLE_HSTS','false'), hsts_max_age_seconds=int(os.getenv('HSTS_MAX_AGE_SECONDS','31536000')), content_security_policy=os.getenv('CONTENT_SECURITY_POLICY',"default-src 'self'; frame-ancestors 'none'; base-uri 'self'"),
        rate_limit_enabled=_bool('RATE_LIMIT_ENABLED','true'), rate_limit_requests_per_minute=int(os.getenv('RATE_LIMIT_REQUESTS_PER_MINUTE','120')), rate_limit_burst=int(os.getenv('RATE_LIMIT_BURST','40')), rate_limit_bundle_requests_per_hour=int(os.getenv('RATE_LIMIT_BUNDLE_REQUESTS_PER_HOUR','20')),
        session_cookie_name=os.getenv('SESSION_COOKIE_NAME','matrix_builder_session'), session_ttl_seconds=int(os.getenv('SESSION_TTL_SECONDS','86400')), session_signing_key=os.getenv('SESSION_SIGNING_KEY','dev-only-session-key-change-before-production'),
        agent_generator_mode=os.getenv('AGENT_GENERATOR_MODE','mock'), matrix_definitions_mode=os.getenv('MATRIX_DEFINITIONS_MODE','mock'), matrixhub_mode=os.getenv('MATRIXHUB_MODE','dry-run'),
        signed_url_ttl_seconds=int(os.getenv('SIGNED_URL_TTL_SECONDS','172800')), signed_url_secret=os.getenv('SIGNED_URL_SECRET','dev-only-change-me'), guest_bundles_per_day=int(os.getenv('GUEST_BUNDLES_PER_DAY','3')), free_bundles_per_month=int(os.getenv('FREE_BUNDLES_PER_MONTH','20')), guest_bundle_ttl_seconds=int(os.getenv('GUEST_BUNDLE_TTL_SECONDS','172800')), free_bundle_ttl_seconds=int(os.getenv('FREE_BUNDLE_TTL_SECONDS','2592000')),
        storage_backend=os.getenv('STORAGE_BACKEND','local'), storage_root=os.getenv('STORAGE_ROOT','.local/matrix-builder-storage'), public_api_base_url=os.getenv('PUBLIC_API_BASE_URL','http://localhost:8000/api/v1'),
        database_url=os.getenv('DATABASE_URL',''), db_pool_size=int(os.getenv('DB_POOL_SIZE','5')), db_max_overflow=int(os.getenv('DB_MAX_OVERFLOW','2')),
        supabase_jwt_secret=os.getenv('MB_JWT_SECRET') or os.getenv('SUPABASE_JWT_SECRET','dev-only-change-me'), supabase_jwt_algorithm=os.getenv('MB_JWT_ALGORITHM') or os.getenv('SUPABASE_JWT_ALGORITHM','HS256'), supabase_jwt_audience=os.getenv('MB_JWT_AUDIENCE') or os.getenv('SUPABASE_JWT_AUDIENCE','authenticated'), supabase_storage_bucket=os.getenv('SUPABASE_STORAGE_BUCKET','matrix-bundles'), google_client_id=os.getenv('GOOGLE_CLIENT_ID',''), resend_api_key=os.getenv('RESEND_API_KEY',''), email_from=os.getenv('EMAIL_FROM','Matrix Builder <onboarding@resend.dev>'), public_app_url=os.getenv('PUBLIC_APP_URL','https://builder.matrixhub.io'), email_link_ttl_seconds=int(os.getenv('EMAIL_LINK_TTL_SECONDS','900')),
        metrics_enabled=_bool('METRICS_ENABLED','true'), otel_enabled=_bool('OTEL_ENABLED','false'), otel_service_name=os.getenv('OTEL_SERVICE_NAME','matrix-builder-api'), otel_exporter_otlp_endpoint=os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT','http://otel-collector:4317'), audit_log_path=os.getenv('AUDIT_LOG_PATH','.local/audit/audit-events.jsonl'), json_logs=_bool('JSON_LOGS','true'), log_level=os.getenv('LOG_LEVEL','INFO'))
