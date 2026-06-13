"""SQLAlchemy engine + RLS-aware sessions (Batch C1).

The engine is built from ``settings.database_url`` (Supabase Postgres). It is intentionally
small-pooled (``db_pool_size`` + ``db_max_overflow``, default 5+2) to stay well under
Supabase's connection limit. ``session_scope(user_id=...)`` opens a transaction and sets the
``app.current_user_id`` GUC so row-level security isolates rows to that user.

When ``database_url`` is empty the app stays on the in-memory repositories (existing tests and
local dev keep working without a database).
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

# Engines/sessionmakers are cached per-DSN so the pool is reused; the registry lets
# ``reset_engine_cache`` dispose them (tests simulate a restart this way).
_ENGINES: dict[str, Engine] = {}
_SESSIONMAKERS: dict[str, sessionmaker[Session]] = {}


def is_configured() -> bool:
    return bool(get_settings().database_url)


def _normalize_dsn(url: str) -> str:
    # Prefer the psycopg (v3) driver; accept plain postg:// / postgresql:// DSNs.
    if url.startswith("postgresql+"):
        return url
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def get_engine(url: str | None = None) -> Engine:
    settings = get_settings()
    dsn = _normalize_dsn(url or settings.database_url)
    if not dsn:
        raise RuntimeError("DATABASE_URL is not configured; persistence is unavailable.")
    if dsn not in _ENGINES:
        _ENGINES[dsn] = create_engine(
            dsn,
            pool_size=settings.db_pool_size,
            max_overflow=settings.db_max_overflow,
            pool_pre_ping=True,
            future=True,
            # Pin UTF-8 so a C/ascii-locale host can't make psycopg return bytes (Aiven is UTF-8).
            connect_args={"client_encoding": "utf8"},
        )
    return _ENGINES[dsn]


def _maker(url: str | None = None) -> sessionmaker[Session]:
    dsn = _normalize_dsn(url or get_settings().database_url)
    if dsn not in _SESSIONMAKERS:
        _SESSIONMAKERS[dsn] = sessionmaker(
            bind=get_engine(url), expire_on_commit=False, future=True
        )
    return _SESSIONMAKERS[dsn]


@contextmanager
def session_scope(user_id: str | None = None, *, url: str | None = None) -> Iterator[Session]:
    """Open a transactional session. If ``user_id`` is given, RLS is scoped to that user.

    Commits on success, rolls back on error, always closes. The GUC is set with ``is_local``
    so it lives only for this transaction.
    """
    session = _maker(url)()
    try:
        if user_id is not None:
            session.execute(
                text("SELECT set_config('app.current_user_id', :uid, true)"),
                {"uid": str(user_id)},
            )
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def reset_engine_cache() -> None:
    """Dispose cached engines and clear the caches (tests use this to simulate a restart)."""
    for engine in _ENGINES.values():
        engine.dispose()
    _ENGINES.clear()
    _SESSIONMAKERS.clear()


def database_status() -> str:
    return "postgres" if is_configured() else "in-memory"


__all__ = [
    "is_configured",
    "get_engine",
    "session_scope",
    "reset_engine_cache",
    "database_status",
]
