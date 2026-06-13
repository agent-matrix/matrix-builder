#!/usr/bin/env bash
# Apply database migrations (ADR 0002 — Aiven PostgreSQL).
#
# Runs as the privileged role: set MIGRATION_DATABASE_URL (avnadmin) — or DATABASE_URL as a
# fallback. The alembic env (services/api/migrations/env.py) prefers MIGRATION_DATABASE_URL.
set -euo pipefail

if [[ -z "${MIGRATION_DATABASE_URL:-}" && -z "${DATABASE_URL:-}" ]]; then
  echo "Set MIGRATION_DATABASE_URL (preferred) or DATABASE_URL to the admin DSN, e.g.:" >&2
  echo "  export MIGRATION_DATABASE_URL='postgresql+psycopg://avnadmin:<PW>@<host>:23188/defaultdb?sslmode=require'" >&2
  exit 2
fi

cd "$(dirname "$0")/../services/api"
echo "Applying migrations to ${MIGRATION_DATABASE_URL:-$DATABASE_URL}" | sed -E 's#://[^@]+@#://***@#'
PYTHONPATH=. python -m alembic upgrade head
echo "Migrations applied. Next: psql \"\$MIGRATION_DATABASE_URL\" -f scripts/aiven_setup.sql"
