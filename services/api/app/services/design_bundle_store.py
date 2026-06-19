"""Persistence for saved Matrix Designer blueprints + chat (batch-10).

Stores the chosen blueprint's Details and Talk-to-blueprint chat per build, owner-scoped,
so reopening a build restores the same state across devices.

Backed by Postgres when ``DATABASE_URL`` is configured AND the ``design_bundles`` table
exists (RLS-isolated per user); falls back to an in-memory store otherwise. Persistence is
best-effort and must never break the Details page, so a missing table degrades to memory.
"""

from __future__ import annotations

import logging
import threading
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.db.engine import is_configured, session_scope
from app.db.orm import DesignBundleRecord

logger = logging.getLogger("matrix_builder.design_bundle_store")

# In-memory fallback, keyed by (owner, build, candidate) so isolation matches the DB's RLS.
_MEM: dict[tuple[str, str, str], dict[str, Any]] = {}
_LOCK = threading.Lock()
_DB_OK: bool | None = None


def _db_usable() -> bool:
    global _DB_OK
    if not is_configured():
        return False
    if _DB_OK is None:
        try:
            with session_scope() as session:
                session.execute(select(DesignBundleRecord.id).limit(1))
            _DB_OK = True
        except SQLAlchemyError:
            logger.warning("design_bundles table unavailable (migration not applied?); using in-memory store")
            _DB_OK = False
    return _DB_OK


class DesignBundleStore:
    def save(self, owner_id: str, build_id: str, candidate_id: str, idea: str,
             details: dict[str, Any], chat_history: list[Any]) -> dict[str, Any]:
        record = {
            "owner_id": owner_id, "build_id": build_id, "candidate_id": candidate_id,
            "idea": idea, "details": details, "chat_history": chat_history,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if _db_usable():
            try:
                with session_scope(user_id=owner_id) as session:
                    existing = session.execute(
                        select(DesignBundleRecord).where(
                            DesignBundleRecord.build_id == build_id,
                            DesignBundleRecord.candidate_id == candidate_id,
                        )
                    ).scalar_one_or_none()
                    if existing is None:
                        session.add(DesignBundleRecord(
                            id=str(uuid.uuid4()), owner_id=owner_id, build_id=build_id,
                            candidate_id=candidate_id, idea=idea, details=details, chat_history=chat_history,
                        ))
                    else:
                        existing.idea = idea
                        existing.details = details
                        existing.chat_history = chat_history
                return record
            except SQLAlchemyError:
                logger.exception("design bundle save failed; falling back to memory")
        with _LOCK:
            _MEM[(owner_id, build_id, candidate_id)] = record
        return record

    def get(self, owner_id: str, build_id: str, candidate_id: str) -> dict[str, Any] | None:
        if _db_usable():
            try:
                with session_scope(user_id=owner_id) as session:
                    row = session.execute(
                        select(DesignBundleRecord).where(
                            DesignBundleRecord.build_id == build_id,
                            DesignBundleRecord.candidate_id == candidate_id,
                        )
                    ).scalar_one_or_none()
                    if row is not None:
                        return {"owner_id": row.owner_id, "build_id": row.build_id, "candidate_id": row.candidate_id,
                                "idea": row.idea, "details": row.details, "chat_history": row.chat_history}
                    return None
            except SQLAlchemyError:
                logger.exception("design bundle get failed; falling back to memory")
        with _LOCK:
            return _MEM.get((owner_id, build_id, candidate_id))


_STORE = DesignBundleStore()


def get_design_bundle_store() -> DesignBundleStore:
    return _STORE
