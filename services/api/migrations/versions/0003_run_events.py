"""Run events + async validation runs (Batch C3).

Adds the append-only ``run_events`` table (with forced owner-scoped RLS) for live streaming and
replay, and evolves ``validation_runs`` for asynchronous, worker-driven runs:

- ``commit_id`` becomes nullable — an async run is validated *before* a commit exists; the
  commit is created only on approval, otherwise the run carries a repair suggestion.
- ``batch_id`` is added so a run can be tied to its batch before any commit exists.

Revision ID: 0003_run_events
Revises: 0002_commit_manifest
Create Date: 2026-06-13
"""

from __future__ import annotations

from alembic import op

revision = "0003_run_events"
down_revision = "0002_commit_manifest"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE validation_runs ALTER COLUMN commit_id DROP NOT NULL")
    op.execute(
        "ALTER TABLE validation_runs "
        "ADD COLUMN batch_id text REFERENCES build_batches(id) ON DELETE CASCADE"
    )
    op.execute("CREATE INDEX ix_validation_runs_batch_id ON validation_runs (batch_id)")

    op.execute(
        """
        CREATE TABLE run_events (
          id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
          owner_id text NOT NULL,
          run_id text NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
          seq bigint NOT NULL,
          event_type text NOT NULL,
          payload_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now(),
          CONSTRAINT uq_run_event_seq UNIQUE (run_id, seq)
        )
        """
    )
    op.execute("CREATE INDEX ix_run_events_owner_id ON run_events (owner_id)")
    op.execute("CREATE INDEX ix_run_events_run_id ON run_events (run_id)")

    # Forced owner-scoped RLS, matching every other exposed table.
    op.execute("ALTER TABLE run_events ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE run_events FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY run_events_owner ON run_events "
        "USING (owner_id = app_current_user()) "
        "WITH CHECK (owner_id = app_current_user())"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS run_events")
    op.execute("DROP INDEX IF EXISTS ix_validation_runs_batch_id")
    op.execute("ALTER TABLE validation_runs DROP COLUMN IF EXISTS batch_id")
    op.execute("ALTER TABLE validation_runs ALTER COLUMN commit_id SET NOT NULL")
