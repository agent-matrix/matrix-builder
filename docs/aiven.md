# Aiven PostgreSQL runbook (ADR 0002)

Matrix Builder persists to **Aiven PostgreSQL**. The app connects as a least-privilege role
(`matrix_app`) so row-level security isolates rows per user; `avnadmin` is used only to migrate.

## 1. Set the two DSNs (env / secret store — never commit them)

```bash
# Admin role — migrations only:
export MIGRATION_DATABASE_URL="postgresql+psycopg://avnadmin:<PW>@pg-3113274d-matrix-builder.a.aivencloud.com:23188/defaultdb?sslmode=require"
# App role — what the API/CLI connect as at runtime:
export DATABASE_URL="postgresql+psycopg://matrix_app:<APP_PW>@pg-3113274d-matrix-builder.a.aivencloud.com:23188/defaultdb?sslmode=require"
export MB_JWT_SECRET="<a long random secret>"
```

## 2. Create the schema (tables, RLS, helper function)

```bash
cd services/api
python -m alembic upgrade head        # runs as avnadmin via MIGRATION_DATABASE_URL
```

## 3. Create the app role and grant it (RLS-safe)

```bash
psql "$MIGRATION_DATABASE_URL" -f scripts/aiven_setup.sql
psql "$MIGRATION_DATABASE_URL" -c "ALTER ROLE matrix_app PASSWORD '<APP_PW>'"
```

`matrix_app` is `NOSUPERUSER NOBYPASSRLS`, so the `FORCE`d owner-scoped policies isolate every
user. Re-run the `GRANT` block after future migrations (or rely on the `ALTER DEFAULT
PRIVILEGES` lines for tables created by `avnadmin`).

## 4. End-to-end smoke

```bash
cd services/api
APP_DATABASE_URL="$DATABASE_URL" python scripts/smoke_workflow.py
```

Expected: it creates a demo project/version/batch, runs an approved execution into a commit,
proves a second user is blocked by RLS, proves the data survives a reconnect, prints the
timeline, and cleans up. `SMOKE_KEEP=1` leaves the demo project behind.

## Notes

- Aiven requires TLS; keep `?sslmode=require` in both DSNs.
- The plan caps connections (20); `DB_POOL_SIZE=5` + `DB_MAX_OVERFLOW=2` stays well under it.
- Auth is a self-issued HS256 JWT signed with `MB_JWT_SECRET` (no Supabase). Tokens must carry
  `sub` (the user id) and `exp`, audience `MB_JWT_AUDIENCE` (default `authenticated`).
- If a credential leaks (chat, log, ticket), rotate it in the Aiven console immediately.

## Create the schema via CI (GitHub Actions)

The sandbox/runtime can't reach Aiven on port 23188, but GitHub runners can. The
**`.github/workflows/db-migrate.yml`** workflow runs `alembic upgrade head`, applies
`aiven_setup.sql` (creates the least-privilege `matrix_app` role + grants), sets the role
password, and verifies the schema with `scripts/db_verify.sql`.

**Add these GitHub repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `MIGRATION_DATABASE_URL` | the **avnadmin** DSN: `postgresql+psycopg://avnadmin:PW@pg-3113274d-matrix-builder.a.aivencloud.com:23188/defaultdb?sslmode=require` |
| `MATRIX_APP_PASSWORD` | password for the `matrix_app` role — **must equal** the password inside the HF Space `DATABASE_URL` |

Then **Actions → db-migrate → Run workflow** (power the Aiven service on first). It also
re-runs automatically when `services/api/migrations/**` changes.

> The runtime app uses **`matrix_app`** (NOSUPERUSER, NOBYPASSRLS) so RLS isolates rows.
> `MIGRATION_DATABASE_URL` belongs in **GitHub Actions secrets**, not the HF Space — the app
> never migrates itself.

Verify any time from a machine that can reach Aiven:
```bash
PSQL_URL="${MIGRATION_DATABASE_URL/+psycopg/}"
psql "$PSQL_URL" -f services/api/scripts/db_verify.sql
```
