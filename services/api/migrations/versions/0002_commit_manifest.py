"""Add commit manifest column to matrix_commits (Batch C2).

The /v1 workflow API records each commit's change set (added/changed/deleted files and the
allowed scope) as a JSONB manifest so ``GET /commits/{id}/diff`` and the build timeline can be
served from Postgres without re-reading object storage.

Revision ID: 0002_commit_manifest
Revises: 0001_workflow_tables
Create Date: 2026-06-13
"""

from __future__ import annotations

from alembic import op

revision = "0002_commit_manifest"
down_revision = "0001_workflow_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE matrix_commits "
        "ADD COLUMN manifest_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE matrix_commits DROP COLUMN manifest_jsonb")
