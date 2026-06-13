---
title: Matrix Builder
emoji: 🟢
colorFrom: green
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# Matrix Builder — Hugging Face Space

Deploy the **Matrix Builder** control-plane API as one simple Docker container on
Hugging Face Spaces. This folder is a **self-contained Space**: the `Dockerfile` fetches
the application from the matrix-builder repository at build time, so you do **not** need to
push the whole monorepo to your Space.

> Give AI coders a contract, not a prompt. This Space serves the Matrix Builder API
> (`/health`, `/api/v1/...`) on port **7860**. The public frontend lives at
> `builder.matrixhub.io` (Vercel) and proxies here via `/api/builder/*` — see
> [`docs/go-live.md`](https://github.com/agent-matrix/matrix-builder/blob/main/docs/go-live.md).

## Deploy in 3 steps

1. **Create the Space** → New Space → **SDK: Docker** → blank.
2. **Add these two files** (`README.md` + `Dockerfile`) to the Space repo root, then push.
   HF builds the `Dockerfile` and serves it on port 7860.
3. **Set secrets** (Settings → *Variables and secrets*):
   - `DATABASE_URL` — the least-privilege `matrix_app` Aiven DSN (`…?sslmode=require`),
     **or** leave unset to run on an ephemeral SQLite demo DB.
   - `MB_JWT_SECRET` — a ≥32-byte random secret.
   - Optional: `APP_ENV=production`, `STORAGE_BACKEND=local`.

To pin a branch or fork, set build args in the Space (or edit the `Dockerfile` defaults):
`MATRIX_BUILDER_REPO` and `MATRIX_BUILDER_REF`.

## Notes

- **Migrations are not run by this container.** An operator applies Alembic migrations
  against Aiven with `make migrate` (privileged `avnadmin` DSN). The web container connects
  only as `matrix_app`.
- **Alternative:** if you'd rather build from the monorepo directly, the repo **root**
  `Dockerfile` is also HF-ready — push the whole repo and HF will use it. This `hf/` folder
  exists so the Space can stay thin and standalone.
- Full deployment guide: [`docs/deploy-huggingface.md`](https://github.com/agent-matrix/matrix-builder/blob/main/docs/deploy-huggingface.md).
