"""Throwaway-Postgres harness for Batch C1 DB/RLS tests.

Boots an ephemeral PostgreSQL cluster (run as the ``postgres`` system user, since the server
refuses to run as root), applies the Alembic migration, and creates a non-superuser
``matrix_app`` role. RLS only takes effect for non-superuser, non-owner connections, so the
tests connect as ``matrix_app`` while migrations run as the superuser.

If PostgreSQL tooling or the ``postgres`` user is unavailable, the whole module is skipped.
"""

from __future__ import annotations

import os
import shutil
import socket
import subprocess
import tempfile
from pathlib import Path

import pytest

API_DIR = Path(__file__).resolve().parents[2]
PG_BIN = Path("/usr/lib/postgresql/16/bin")
_RUNUSER = shutil.which("runuser")


def _free_port() -> int:
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def _as_postgres(*args: str, **kw) -> subprocess.CompletedProcess:
    return subprocess.run(
        [_RUNUSER, "-u", "postgres", "--", *args], capture_output=True, text=True, **kw
    )


def _available() -> bool:
    return (PG_BIN / "initdb").exists() and _RUNUSER is not None and shutil.which("psql") is not None


@pytest.fixture(scope="session")
def pg_cluster():
    if not _available():
        pytest.skip("PostgreSQL tooling / runuser / postgres user not available")

    workdir = Path(tempfile.mkdtemp(prefix="mb-pg-"))
    datadir = workdir / "data"
    datadir.mkdir()
    # The postgres user must own everything it touches.
    shutil.chown(workdir, user="postgres", group="postgres")
    shutil.chown(datadir, user="postgres", group="postgres")

    init = _as_postgres(str(PG_BIN / "initdb"), "-D", str(datadir), "-U", "postgres", "--auth=trust")
    if init.returncode != 0:
        shutil.rmtree(workdir, ignore_errors=True)
        pytest.skip(f"initdb failed: {init.stderr[-400:]}")

    port = _free_port()
    logfile = workdir / "pg.log"
    start = _as_postgres(
        str(PG_BIN / "pg_ctl"),
        "-D", str(datadir),
        "-l", str(logfile),
        "-o", f"-p {port} -c listen_addresses=127.0.0.1 -c unix_socket_directories={workdir}",
        "-w", "start",
    )
    if start.returncode != 0:
        shutil.rmtree(workdir, ignore_errors=True)
        pytest.skip(f"pg_ctl start failed: {start.stderr[-400:]}{logfile.read_text()[-400:] if logfile.exists() else ''}")

    admin_dsn = f"postgresql://postgres@127.0.0.1:{port}/matrix_test"
    app_dsn = f"postgresql://matrix_app@127.0.0.1:{port}/matrix_test"
    try:
        import psycopg

        # Create the test database (autocommit; CREATE DATABASE can't run in a transaction).
        with psycopg.connect(f"postgresql://postgres@127.0.0.1:{port}/postgres", autocommit=True) as c:
            c.execute("CREATE DATABASE matrix_test")

        # Apply migrations as the superuser via the project's Alembic env.
        env = {**os.environ, "DATABASE_URL": admin_dsn, "PYTHONPATH": str(API_DIR)}
        up = subprocess.run(
            ["python3", "-m", "alembic", "upgrade", "head"],
            cwd=str(API_DIR), env=env, capture_output=True, text=True,
        )
        if up.returncode != 0:
            pytest.skip(f"alembic upgrade failed: {up.stderr[-800:]}")

        # Create the non-superuser app role and grant it table access.
        with psycopg.connect(admin_dsn, autocommit=True) as c:
            c.execute("CREATE ROLE matrix_app LOGIN")
            c.execute("GRANT USAGE ON SCHEMA public TO matrix_app")
            c.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO matrix_app")
            c.execute("GRANT EXECUTE ON FUNCTION app_current_user() TO matrix_app")

        yield {"admin_dsn": admin_dsn, "app_dsn": app_dsn, "port": port}
    finally:
        _as_postgres(str(PG_BIN / "pg_ctl"), "-D", str(datadir), "-m", "immediate", "stop")
        shutil.rmtree(workdir, ignore_errors=True)


_WORKFLOW_TABLES = (
    "run_events",
    "validation_findings",
    "validation_runs",
    "matrix_commits",
    "prompt_versions",
    "build_batches",
    "bundle_versions",
    "artifacts",
    "projects",
    "users",
)


@pytest.fixture(autouse=True)
def _clean_db(pg_cluster):
    """Truncate all workflow tables before each test so the shared cluster stays isolated."""
    import psycopg

    with psycopg.connect(pg_cluster["admin_dsn"], autocommit=True) as c:
        c.execute("TRUNCATE " + ", ".join(_WORKFLOW_TABLES) + " RESTART IDENTITY CASCADE")
    yield


@pytest.fixture()
def app_dsn(pg_cluster) -> str:
    """DSN for the non-superuser app role (RLS-enforced)."""
    from app.db.engine import reset_engine_cache

    reset_engine_cache()
    yield pg_cluster["app_dsn"]
    reset_engine_cache()
