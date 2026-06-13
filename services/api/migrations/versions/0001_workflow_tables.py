"""Continuous Build workflow tables + RLS (Batch C1).

Creates users, projects, and the seven workflow tables, the ``app_current_user()`` GUC helper,
and forced owner-scoped row-level security on every exposed table. Ids are ``text`` (UUID
strings) to match the ORM's ``String(36)`` mapping and the app-side id generation.

Revision ID: 0001_workflow_tables
Revises:
Create Date: 2026-06-13
"""

from __future__ import annotations

from alembic import op

revision = "0001_workflow_tables"
down_revision = None
branch_labels = None
depends_on = None

# Tables that are exposed to callers and get owner-scoped RLS (projects + 7 workflow tables).
_OWNER_RLS_TABLES = (
    "projects",
    "bundle_versions",
    "build_batches",
    "matrix_commits",
    "prompt_versions",
    "validation_runs",
    "validation_findings",
    "artifacts",
)

_TABLES_SQL = [
    """
    CREATE TABLE users (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      email text UNIQUE,
      display_name text,
      plan text NOT NULL DEFAULT 'free',
      created_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE projects (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      owner_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title text NOT NULL,
      slug text NOT NULL,
      description text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'active',
      privacy text NOT NULL DEFAULT 'private',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE bundle_versions (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      owner_id text NOT NULL,
      project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      parent_version_id text REFERENCES bundle_versions(id),
      version_label text NOT NULL,
      title text NOT NULL,
      requirements_md text NOT NULL DEFAULT '',
      blueprint_artifact_id text,
      status text NOT NULL DEFAULT 'active',
      created_by text NOT NULL REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE build_batches (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      owner_id text NOT NULL,
      version_id text NOT NULL REFERENCES bundle_versions(id) ON DELETE CASCADE,
      parent_commit_id text,
      ordinal int NOT NULL,
      title text NOT NULL,
      goal_md text NOT NULL DEFAULT '',
      change_type text NOT NULL,
      status text NOT NULL DEFAULT 'draft',
      requested_by text NOT NULL REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (version_id, ordinal)
    )
    """,
    """
    CREATE TABLE matrix_commits (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      owner_id text NOT NULL,
      batch_id text NOT NULL REFERENCES build_batches(id) ON DELETE CASCADE,
      version_id text NOT NULL REFERENCES bundle_versions(id) ON DELETE CASCADE,
      parent_commit_id text REFERENCES matrix_commits(id),
      commit_no int NOT NULL,
      summary text NOT NULL DEFAULT '',
      tree_hash text NOT NULL,
      validation_status text NOT NULL DEFAULT 'not-run',
      prompt_pack_id text,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (version_id, commit_no)
    )
    """,
    """
    CREATE TABLE prompt_versions (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      owner_id text NOT NULL,
      batch_id text NOT NULL REFERENCES build_batches(id) ON DELETE CASCADE,
      coder text NOT NULL,
      prompt_text text NOT NULL,
      constraints_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb,
      artifact_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
    """,
    """
    CREATE TABLE validation_runs (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      owner_id text NOT NULL,
      commit_id text NOT NULL REFERENCES matrix_commits(id) ON DELETE CASCADE,
      status text NOT NULL,
      score int,
      runner text NOT NULL DEFAULT 'local',
      started_at timestamptz NOT NULL DEFAULT now(),
      ended_at timestamptz
    )
    """,
    """
    CREATE TABLE validation_findings (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      owner_id text NOT NULL,
      validation_run_id text NOT NULL REFERENCES validation_runs(id) ON DELETE CASCADE,
      severity text NOT NULL,
      status text NOT NULL,
      check_name text NOT NULL,
      file_path text,
      message text NOT NULL,
      remediation text
    )
    """,
    """
    CREATE TABLE artifacts (
      id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      owner_id text NOT NULL,
      project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      version_id text REFERENCES bundle_versions(id) ON DELETE CASCADE,
      commit_id text REFERENCES matrix_commits(id) ON DELETE CASCADE,
      artifact_type text NOT NULL,
      storage_key text NOT NULL,
      sha256 text NOT NULL,
      size_bytes bigint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
    """,
]

_INDEXES = [
    "CREATE INDEX ix_projects_owner ON projects(owner_id)",
    "CREATE INDEX ix_versions_project ON bundle_versions(project_id)",
    "CREATE INDEX ix_batches_version ON build_batches(version_id)",
    "CREATE INDEX ix_commits_version ON matrix_commits(version_id)",
    "CREATE INDEX ix_findings_run ON validation_findings(validation_run_id)",
    "CREATE INDEX ix_artifacts_project ON artifacts(project_id)",
]


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    # The RLS predicate: the user id set per-transaction via set_config('app.current_user_id').
    op.execute(
        "CREATE OR REPLACE FUNCTION app_current_user() RETURNS text "
        "LANGUAGE sql STABLE AS $$ SELECT current_setting('app.current_user_id', true) $$"
    )
    for sql in _TABLES_SQL:
        op.execute(sql)
    for sql in _INDEXES:
        op.execute(sql)

    # users: a user may see only their own row.
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE users FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY users_self ON users "
        "USING (id = app_current_user()) WITH CHECK (id = app_current_user())"
    )

    # projects + workflow tables: owner-scoped isolation.
    for table in _OWNER_RLS_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"CREATE POLICY {table}_owner ON {table} "
            "USING (owner_id = app_current_user()) WITH CHECK (owner_id = app_current_user())"
        )


def downgrade() -> None:
    for table in (*reversed(_OWNER_RLS_TABLES), "users"):
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
    op.execute("DROP FUNCTION IF EXISTS app_current_user()")
