"""Saved Matrix Designer Blueprint Details + chat per build (batch-10).

Owner-scoped table that persists the chosen blueprint's details and the
Talk-to-blueprint chat history for a build, so reopening it restores the same
state across devices — RLS-isolated per user like every other workflow table.
"""

from __future__ import annotations

from alembic import op

revision = "0006_design_bundles"
down_revision = "0005_gitpilot_runs"
branch_labels = None
depends_on = None

_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS design_bundles (
  id            text PRIMARY KEY,
  owner_id      text NOT NULL,
  build_id      text NOT NULL,
  candidate_id  text NOT NULL,
  idea          text NOT NULL DEFAULT '',
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  chat_history  jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_design_bundle_owner_build_cand UNIQUE (owner_id, build_id, candidate_id)
)
"""


def upgrade() -> None:
    op.execute(_TABLE_SQL)
    op.execute("CREATE INDEX IF NOT EXISTS ix_design_bundles_owner ON design_bundles(owner_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_design_bundles_owner_build "
        "ON design_bundles(owner_id, build_id)"
    )
    op.execute("ALTER TABLE design_bundles ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE design_bundles FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY design_bundles_owner ON design_bundles "
        "USING (owner_id = app_current_user()) WITH CHECK (owner_id = app_current_user())"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS design_bundles CASCADE")
