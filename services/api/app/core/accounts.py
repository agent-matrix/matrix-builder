"""User accounts (traditional email + password, plus Google).

Stored in the ``auth_accounts`` table when a database is configured (it has NO row-level
security — it's the credential table, queried by email before any session exists), otherwise
in an in-memory dict for local dev / tests.

The login subject used for RLS elsewhere is ``account:<id>`` (stable per account).
"""
from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import text

from app.core.logging import get_logger
from app.db import engine as db

logger = get_logger(__name__)


@dataclass
class Account:
    id: str
    email: str
    password_hash: str | None
    name: str | None
    is_active: bool
    provider: str  # "password" | "google"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _norm(email: str) -> str:
    return email.strip().lower()


class AccountStore:
    def get_by_email(self, email: str) -> Account | None: ...
    def create(self, email: str, password_hash: str | None, *, name: str | None, is_active: bool, provider: str) -> Account: ...
    def set_active(self, email: str, active: bool = True) -> None: ...
    def set_password(self, email: str, password_hash: str) -> None: ...
    def set_name(self, email: str, name: str | None) -> None: ...
    def delete_by_email(self, email: str) -> None: ...


class InMemoryAccountStore(AccountStore):
    def __init__(self) -> None:
        self._rows: dict[str, Account] = {}
        self._lock = threading.Lock()

    def get_by_email(self, email: str) -> Account | None:
        return self._rows.get(_norm(email))

    def create(self, email, password_hash, *, name, is_active, provider):
        acc = Account(id=uuid.uuid4().hex, email=_norm(email), password_hash=password_hash,
                      name=name, is_active=is_active, provider=provider)
        with self._lock:
            self._rows[acc.email] = acc
        return acc

    def set_active(self, email, active=True):
        with self._lock:
            acc = self._rows.get(_norm(email))
            if acc:
                acc.is_active = active

    def set_password(self, email, password_hash):
        with self._lock:
            acc = self._rows.get(_norm(email))
            if acc:
                acc.password_hash = password_hash
                acc.is_active = True  # resetting a password proves inbox ownership

    def set_name(self, email, name):
        with self._lock:
            acc = self._rows.get(_norm(email))
            if acc:
                acc.name = name

    def delete_by_email(self, email):
        with self._lock:
            self._rows.pop(_norm(email), None)


class DbAccountStore(AccountStore):
    """Postgres-backed; uses a non-RLS session (auth_accounts has no row-level security)."""

    def get_by_email(self, email: str) -> Account | None:
        with db.session_scope() as s:
            row = s.execute(
                text("SELECT id, email, password_hash, name, is_active, provider FROM auth_accounts WHERE email = :e"),
                {"e": _norm(email)},
            ).first()
        if not row:
            return None
        return Account(id=row[0], email=row[1], password_hash=row[2], name=row[3], is_active=row[4], provider=row[5])

    def create(self, email, password_hash, *, name, is_active, provider):
        acc = Account(id=uuid.uuid4().hex, email=_norm(email), password_hash=password_hash,
                      name=name, is_active=is_active, provider=provider)
        with db.session_scope() as s:
            s.execute(
                text("INSERT INTO auth_accounts (id, email, password_hash, name, is_active, provider, created_at) "
                     "VALUES (:id, :email, :ph, :name, :active, :provider, :ts)"),
                {"id": acc.id, "email": acc.email, "ph": acc.password_hash, "name": acc.name,
                 "active": acc.is_active, "provider": acc.provider, "ts": _now()},
            )
        return acc

    def set_active(self, email, active=True):
        with db.session_scope() as s:
            s.execute(text("UPDATE auth_accounts SET is_active = :a WHERE email = :e"), {"a": active, "e": _norm(email)})

    def set_password(self, email, password_hash):
        with db.session_scope() as s:
            s.execute(text("UPDATE auth_accounts SET password_hash = :p, is_active = true WHERE email = :e"),
                      {"p": password_hash, "e": _norm(email)})

    def set_name(self, email, name):
        with db.session_scope() as s:
            s.execute(text("UPDATE auth_accounts SET name = :n WHERE email = :e"), {"n": name, "e": _norm(email)})

    def delete_by_email(self, email):
        with db.session_scope() as s:
            s.execute(text("DELETE FROM auth_accounts WHERE email = :e"), {"e": _norm(email)})


_memory_singleton = InMemoryAccountStore()
_db_ready: bool | None = None


def _db_accounts_ready() -> bool:
    """Probe once whether the auth_accounts table exists. If a DATABASE_URL is set but the
    migration hasn't run, fall back to in-memory so sign-up still works (run db-migrate +
    restart to switch to durable Postgres)."""
    global _db_ready
    if _db_ready is None:
        try:
            with db.session_scope() as s:
                s.execute(text("SELECT 1 FROM auth_accounts LIMIT 1"))
            _db_ready = True
        except Exception:  # noqa: BLE001 — table missing / DB unreachable
            logger.warning("auth_accounts unavailable — using in-memory accounts. Run the db-migrate workflow, then restart.")
            _db_ready = False
    return _db_ready


def get_account_store() -> AccountStore:
    """Postgres-backed when DATABASE_URL is set AND the table exists; in-memory otherwise."""
    return DbAccountStore() if (db.is_configured() and _db_accounts_ready()) else _memory_singleton


def reset_memory_store() -> None:  # test helper
    global _db_ready
    _db_ready = None
    _memory_singleton._rows.clear()


__all__ = ["Account", "AccountStore", "InMemoryAccountStore", "DbAccountStore", "get_account_store", "reset_memory_store"]
