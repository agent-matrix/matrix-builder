"""Alembic environment (Batch C1).

Reads the database URL from ``DATABASE_URL`` (via the app settings, normalized to the psycopg
driver) rather than from alembic.ini, so the same secret-via-env discipline applies.
"""

from __future__ import annotations

import os

from alembic import context
from sqlalchemy import pool

from app.core.config import get_settings
from app.db.engine import _normalize_dsn
from app.db.orm import Base

config = context.config
target_metadata = Base.metadata


def _url() -> str:
    # Migrations run as the privileged role (Aiven: avnadmin) via MIGRATION_DATABASE_URL; the app
    # connects as the least-privilege role (matrix_app) via DATABASE_URL. Falls back to
    # DATABASE_URL when no separate migration URL is set.
    raw = os.getenv("MIGRATION_DATABASE_URL") or get_settings().database_url
    url = _normalize_dsn(raw)
    if not url:
        raise RuntimeError("MIGRATION_DATABASE_URL or DATABASE_URL must be set to run migrations.")
    return url


def run_migrations_offline() -> None:
    context.configure(
        url=_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    from sqlalchemy import create_engine

    # Pin UTF-8 (same reason as app.db.engine): a C/ascii-locale host must not make psycopg
    # return bytes for the server version string.
    connectable = create_engine(
        _url(), poolclass=pool.NullPool, connect_args={"client_encoding": "utf8"}
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
