"""Persistence for GitPilot run history (Batch 10).

Records each GitPilot run (cloud/local), its synced status, and the Matrix
verdict, owner-scoped so a user's runs survive restarts and are queryable.

Backed by Postgres when ``DATABASE_URL`` is configured AND the ``gitpilot_runs``
table exists (RLS-isolated per user), falling back to an in-memory store
otherwise. Recording history is best-effort: it must never break the core run
flow, so if the table is missing (migration not yet applied) we degrade to
in-memory instead of erroring.
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Iterable
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.db.engine import is_configured, session_scope
from app.db.orm import GitPilotRun

logger = logging.getLogger("matrix_builder.gitpilot_run_store")

# In-memory fallback. Keyed by run id; each value carries its owner so list/get
# can enforce the same per-owner isolation the DB does via RLS.
_MEM: dict[str, dict[str, Any]] = {}
_LOCK = threading.Lock()

# Cached probe: is the gitpilot_runs table actually usable? None = not yet probed.
_DB_OK: bool | None = None


def _db_usable() -> bool:
    """True iff Postgres is configured and the gitpilot_runs table is queryable.

    Probed once and cached. If the table is missing (migration not applied) or
    the DB is unreachable, we fall back to in-memory so history never 500s the
    user-facing run flow.
    """
    global _DB_OK
    if not is_configured():
        return False
    if _DB_OK is None:
        try:
            with session_scope() as session:
                session.execute(select(GitPilotRun.id).limit(1))
            _DB_OK = True
        except SQLAlchemyError:
            logger.warning(
                "gitpilot_runs table unavailable (migration not applied?); "
                "using in-memory run history"
            )
            _DB_OK = False
    return _DB_OK


def reset_db_probe() -> None:
    """Forget the cached probe (tests / after a migration + restart)."""
    global _DB_OK
    _DB_OK = None


_PUBLIC_FIELDS = (
    "id",
    "owner_id",
    "bundle_id",
    "task_id",
    "source",
    "status",
    "test_status",
    "summary",
    "changed_files",
    "validation_status",
    "can_commit",
    "parent_run_id",
)


def _row_to_dict(row: GitPilotRun) -> dict[str, Any]:
    return {
        "id": row.id,
        "owner_id": row.owner_id,
        "bundle_id": row.bundle_id,
        "task_id": row.task_id,
        "source": row.source,
        "status": row.status,
        "test_status": row.test_status,
        "summary": row.summary,
        "changed_files": list(row.changed_files or []),
        "validation_status": row.validation_status,
        "can_commit": bool(row.can_commit),
        "parent_run_id": row.parent_run_id,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


class GitPilotRunStore:
    """DB-or-memory store for GitPilot run records."""

    @property
    def backend(self) -> str:
        return "postgres" if _db_usable() else "in-memory"

    # -- writes --------------------------------------------------------------

    def record(
        self,
        *,
        run_id: str,
        owner_id: str,
        bundle_id: str,
        task_id: str | None = None,
        source: str = "cloud",
        status: str = "queued",
        parent_run_id: str | None = None,
    ) -> None:
        if _db_usable():
            with session_scope(user_id=owner_id) as session:
                row = session.get(GitPilotRun, run_id)
                if row is None:
                    session.add(
                        GitPilotRun(
                            id=run_id,
                            owner_id=owner_id,
                            bundle_id=bundle_id,
                            task_id=task_id,
                            source=source,
                            status=status,
                            parent_run_id=parent_run_id,
                        )
                    )
            return
        with _LOCK:
            _MEM[run_id] = {
                "id": run_id,
                "owner_id": owner_id,
                "bundle_id": bundle_id,
                "task_id": task_id,
                "source": source,
                "status": status,
                "test_status": "not_run",
                "summary": "",
                "changed_files": [],
                "validation_status": None,
                "can_commit": False,
                "parent_run_id": parent_run_id,
                "created_at": None,
            }

    def update_status(
        self,
        run_id: str,
        owner_id: str,
        *,
        status: str,
        test_status: str = "not_run",
        summary: str = "",
        changed_files: Iterable[str] | None = None,
    ) -> None:
        files = list(changed_files or [])
        if _db_usable():
            with session_scope(user_id=owner_id) as session:
                row = self._owned_row(session, run_id, owner_id)
                if row is not None:
                    row.status = status
                    row.test_status = test_status
                    row.summary = summary
                    row.changed_files = files
            return
        with _LOCK:
            rec = _MEM.get(run_id)
            if rec is not None and rec["owner_id"] == owner_id:
                rec.update(
                    status=status, test_status=test_status, summary=summary, changed_files=files
                )

    def record_validation(
        self, run_id: str, owner_id: str, *, validation_status: str, can_commit: bool
    ) -> None:
        if _db_usable():
            with session_scope(user_id=owner_id) as session:
                row = self._owned_row(session, run_id, owner_id)
                if row is not None:
                    row.validation_status = validation_status
                    row.can_commit = can_commit
            return
        with _LOCK:
            rec = _MEM.get(run_id)
            if rec is not None and rec["owner_id"] == owner_id:
                rec.update(validation_status=validation_status, can_commit=can_commit)

    # -- reads ---------------------------------------------------------------

    def get(self, run_id: str, owner_id: str) -> dict[str, Any] | None:
        if _db_usable():
            with session_scope(user_id=owner_id) as session:
                row = self._owned_row(session, run_id, owner_id)
                return _row_to_dict(row) if row is not None else None
        with _LOCK:
            rec = _MEM.get(run_id)
            return dict(rec) if rec is not None and rec["owner_id"] == owner_id else None

    @staticmethod
    def _owned_row(session, run_id: str, owner_id: str) -> GitPilotRun | None:  # type: ignore[no-untyped-def]
        # Explicit owner filter — isolation holds even if the DB role bypasses RLS
        # (e.g. a superuser). RLS is the second line of defense for app roles.
        return session.execute(
            select(GitPilotRun).where(GitPilotRun.id == run_id, GitPilotRun.owner_id == owner_id)
        ).scalar_one_or_none()

    def list(
        self, owner_id: str, bundle_id: str | None = None, limit: int = 50
    ) -> list[dict[str, Any]]:
        if _db_usable():
            from sqlalchemy import select

            with session_scope(user_id=owner_id) as session:
                stmt = select(GitPilotRun).where(GitPilotRun.owner_id == owner_id)
                if bundle_id:
                    stmt = stmt.where(GitPilotRun.bundle_id == bundle_id)
                stmt = stmt.order_by(GitPilotRun.created_at.desc()).limit(limit)
                return [_row_to_dict(r) for r in session.execute(stmt).scalars()]
        with _LOCK:
            rows = [
                dict(r)
                for r in _MEM.values()
                if r["owner_id"] == owner_id and (bundle_id is None or r["bundle_id"] == bundle_id)
            ]
        return rows[:limit]


_store = GitPilotRunStore()


def get_run_store() -> GitPilotRunStore:
    return _store
