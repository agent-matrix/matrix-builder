# Deploy on Hugging Face Spaces (simple Docker)

Matrix Builder runs as **one simple Docker container** — no Kubernetes, no read replicas, no
broker. The repo root `Dockerfile` is Hugging Face Spaces-ready (listens on port **7860**).

**Fastest path:** the [`hf/`](../hf/) folder is a thin, standalone Space — copy its
`README.md` + `Dockerfile` into a new Docker Space and it fetches the app at build time
(no need to push the whole monorepo). The rest of this guide also works if you push the
repo and let HF use the root `Dockerfile`.

## 1. Create the Space
- New Space → **SDK: Docker** → blank.
- Add this front-matter to the Space's `README.md`:

```yaml
---
title: Matrix Builder
emoji: 🟢
colorFrom: green
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
---
```

## 2. Point it at this repo
Either push this repo to the Space, or keep a thin Space that builds from the root `Dockerfile`
(it installs `requirements.txt` via uv and serves `app.main:app` on 7860).

## 3. Set Space secrets (Settings → Variables and secrets)
- `DATABASE_URL` — the **least-privilege** `matrix_app` Aiven DSN (`…?sslmode=require`).
- `MB_JWT_SECRET` — a ≥32-byte random secret.
- `STORAGE_BACKEND=local` (or `s3` once object storage lands; see backlog DATA-01).
- Optional: `APP_ENV=production`, `PUBLIC_API_BASE_URL`.

Secrets live only in the Space; nothing is committed.

## 4. Migrate the database once (operator, not the container)
The web container does **not** self-migrate. From a machine that can reach Aiven:

```bash
export MIGRATION_DATABASE_URL="postgresql+psycopg://avnadmin:<PW>@<host>:23188/defaultdb?sslmode=require"
make migrate
psql "$MIGRATION_DATABASE_URL" -f services/api/scripts/aiven_setup.sql
psql "$MIGRATION_DATABASE_URL" -c "ALTER ROLE matrix_app PASSWORD '<APP_PW>'"
```

## 5. Verify
- Space build logs show `uvicorn running on 0.0.0.0:7860`.
- `https://<user>-<space>.hf.space/health` returns `{"status":"ok"}`.
- `GET /api/v1/...` requires a bearer JWT (mint one with `mb login --as <user-id>`).

## Notes
- The Aiven free tier caps connections at 20; `DB_POOL_SIZE=5` + `DB_MAX_OVERFLOW=2` stays under
  it for a single container. Scale vertically (Aiven plan) before adding more containers.
- This is deliberately simple: a single always-on container is enough for launch. A worker
  broker/pool is optional and only added under real concurrency (backlog SCALE-01).
