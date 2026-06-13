"""Auth accounts (traditional email+password + Google).

The credential table is queried by email *before* a session exists, so it has NO row-level
security (unlike the per-user workflow tables). Access is controlled by the auth endpoints.

Revision ID: 0004_auth_accounts
Revises: 0003_run_events
"""
from __future__ import annotations

from alembic import op

revision = "0004_auth_accounts"
down_revision = "0003_run_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS auth_accounts (
            id            text PRIMARY KEY,
            email         text NOT NULL UNIQUE,
            password_hash text,
            name          text,
            is_active     boolean NOT NULL DEFAULT false,
            provider      text NOT NULL DEFAULT 'password',
            created_at    timestamptz NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS auth_accounts_email_idx ON auth_accounts (email)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS auth_accounts")
