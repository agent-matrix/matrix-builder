"""GitPilot run history table (Batch 10).

Owner-scoped table recording each GitPilot run (cloud/local), its synced status,
and the Matrix verdict — RLS-isolated per user like every other workflow table.
"""

from __future__ import annotations

from alembic import op

revision = "0005_gitpilot_runs"
down_revision = "0004_auth_accounts"
branch_labels = None
depends_on = None

_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS gitpilot_runs (
  id                text PRIMARY KEY,
  owner_id          text NOT NULL,
  bundle_id         text NOT NULL,
  task_id           text,
  source            text NOT NULL DEFAULT 'cloud',
  status            text NOT NULL DEFAULT 'queued',
  test_status       text NOT NULL DEFAULT 'not_run',
  summary           text NOT NULL DEFAULT '',
  changed_files     jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_status text,
  can_commit        boolean NOT NULL DEFAULT false,
  parent_run_id     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
)
"""


def upgrade() -> None:
    op.execute(_TABLE_SQL)
    op.execute("CREATE INDEX IF NOT EXISTS ix_gitpilot_runs_owner ON gitpilot_runs(owner_id)")
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_gitpilot_runs_owner_bundle "
        "ON gitpilot_runs(owner_id, bundle_id)"
    )
    op.execute("ALTER TABLE gitpilot_runs ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE gitpilot_runs FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY gitpilot_runs_owner ON gitpilot_runs "
        "USING (owner_id = app_current_user()) WITH CHECK (owner_id = app_current_user())"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS gitpilot_runs CASCADE")
