# ADR 0002 — Aiven PostgreSQL adopted; Supabase dropped (cost)

Status: accepted (supersedes ADR 0001)
Date: 2026-06-13

## Decision

Matrix Builder uses **Aiven PostgreSQL** as its datastore and a **self-issued HS256 JWT** for
auth. Supabase is **not** used. This reverses ADR 0001.

### Why (cost)

We are starting out. Supabase's bundled platform (hosted Postgres + Auth + Storage) is more than
we need and more expensive than a single small managed Postgres. Aiven already runs our instance
(`pg-3113274d`, PostgreSQL 17, sfo) on a free/low tier. So we keep one cheap managed Postgres and
provide auth + storage ourselves — none of which required Supabase in the first place:

- **Database → Aiven Postgres.** The C1 ORM, Alembic migrations, and row-level security run on
  any standards-compliant Postgres; only `DATABASE_URL` changes.
- **Auth → self-issued HS256 JWT.** The API already *verified* a JWT with a shared secret and
  never called Supabase at request time. We now also *issue* that token ourselves (see the `mb
  login` flow and `MB_JWT_SECRET`). No external IdP, no per-MAU billing.
- **Storage → object storage (`ObjectStorage`).** Already local/S3, never Supabase Storage.

## RLS on Aiven (important)

RLS only isolates rows for a connection that is **not** a superuser and does **not** have
`BYPASSRLS`. Aiven's `avnadmin` owns the tables, so the application must connect as a dedicated
least-privilege role:

- **`avnadmin`** runs migrations only (`alembic upgrade head`), via `MIGRATION_DATABASE_URL`.
- **`matrix_app`** (`NOSUPERUSER NOBYPASSRLS`) is what the API connects as, via `DATABASE_URL`.
  Every policy is `FORCE`d and owner-scoped (`owner_id = app_current_user()`), so isolation holds
  even though `avnadmin` owns the tables. Bootstrap: `services/api/scripts/aiven_setup.sql`.

The API sets the `app.current_user_id` GUC per transaction from the verified JWT
(`session_scope(user_id=...)`), exactly as before.

## Connection discipline

The Aiven instance caps connections (20 on the current plan). The engine pool stays small
(`DB_POOL_SIZE=5`, `DB_MAX_OVERFLOW=2`) to stay well under it. Aiven requires TLS, so the DSN
carries `?sslmode=require`.

## Secrets

`DATABASE_URL` / `MIGRATION_DATABASE_URL` / `MB_JWT_SECRET` are injected via environment or the
secret store only — never committed. If a credential is ever pasted into a chat, ticket, or log,
rotate it in the Aiven console.

## Runbook

See `docs/aiven.md` for the exact create-schema + smoke-test commands.
