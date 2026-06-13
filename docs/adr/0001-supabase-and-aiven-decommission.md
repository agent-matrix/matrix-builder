# ADR 0001 — Supabase for persistence; Aiven Postgres decommissioned

Status: SUPERSEDED by ADR 0002 (2026-06-13) — Supabase was dropped for cost; Aiven PostgreSQL is
now the datastore and auth is a self-issued HS256 JWT. Text kept for history.
Date: 2026-06-13

## Decision

Matrix Builder uses **Supabase** as its persistence platform:

- **Supabase Auth** — the FastAPI API verifies the Supabase JWT (HS256 with the project JWT
  secret) and extracts the user id (`sub`). See `app/core/auth.py`.
- **Supabase Postgres** — the seven Continuous Build workflow tables (`bundle_versions`,
  `build_batches`, `matrix_commits`, `prompt_versions`, `validation_runs`,
  `validation_findings`, `artifacts`) plus `users`/`projects`, with **forced owner-scoped
  row-level security** on every exposed table. See `app/db/orm.py` and
  `migrations/versions/0001_workflow_tables.py`.
- **Supabase Storage** — bundles, prompts, diffs, logs, and thumbnails under the immutable key
  layout in `app/storage/workflow_paths.py` (`projects/{p}/versions/{v}/…`, `commits/{c}/…`).
  Metadata lives in Postgres; bytes live in object storage (never blobs in the database).

## Why one service

The workflow needs auth (ownership), a relational store with policy enforcement (RLS), and
object storage. Supabase provides all three with one integration: JWT-backed auth, Postgres
RLS that acts like an automatic `WHERE owner_id = me`, and policy-controlled buckets. Splitting
these across providers adds operational surface for no benefit at this stage.

## Aiven decommission

The previously provisioned **Aiven PostgreSQL `pg-3113274d`** is **decommissioned** for Matrix
Builder. Rationale:

- Migration cost is zero: the store was still in-memory at C1, so no data moves.
- Running two databases was explicitly ruled out ("pick one; don't run both").
- Aiven provides Postgres only; it does not cover auth or object storage, so it would not
  reduce the integration surface.

Action: stop the Aiven service (or keep a cold backup until C4 ships, then delete). No code
references the Aiven DSN; `DATABASE_URL` points at Supabase Postgres and is injected via
environment/secret only — never committed.

## Connection discipline

Supabase free/standard tiers cap connections. The engine pool is intentionally small
(`db_pool_size=5`, `db_max_overflow=2`) to stay well under the limit; workers reuse the same
discipline. Use the Supabase **transaction pooler** DSN for serverless/worker contexts.

## RLS mechanics

Policies compare `owner_id` to `app_current_user()`, a `STABLE` SQL function reading the
`app.current_user_id` GUC. The API sets that GUC per transaction from the verified JWT
(`session_scope(user_id=...)`). RLS is `FORCE`d so even the table owner is subject to it; the
application connects as a non-superuser role (Supabase's `authenticated`), so isolation holds.
