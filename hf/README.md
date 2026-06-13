---
title: Matrix Builder
emoji: 🟢
colorFrom: green
colorTo: gray
sdk: docker
app_port: 7860
pinned: false
license: mit
short_description: Give AI coders a contract, not a prompt.
tags:
  - ai-coding
  - governance
  - nextjs
  - fastapi
---

# Matrix Builder — full stack on one Space

The complete app on a single Hugging Face Space: the **Next.js UI** is the public server
(port 7860) and proxies `/api/builder/*` to the **FastAPI** backend running internally on
`127.0.0.1:8000` — same-origin, no CORS. This mirrors the Vercel topology exactly, from the
**same `apps/web` source** (no second frontend codebase).

- **UI:** `/` · **API docs:** `/api/builder/docs` · **Health:** `/api/builder/health`
- **Ecosystem:** [agent-generator](https://huggingface.co/spaces/ruslanmv/agent-generator) ·
  [GitPilot](https://huggingface.co/spaces/ruslanmv/gitpilot) ·
  [standard](https://www.matrixhub.io/definitions)

## How it's deployed (single source)

`apps/web` is the only frontend source. It runs in two places, both built from it:

| Where | Builds from | Backend |
|---|---|---|
| **Vercel** (`builder.matrixhub.io`) | `apps/web` (root dir) | rewrites `/api/builder/*` → this Space's public `/api/builder` |
| **HF Space** (this) | `apps/web` staged as `web/` by CI, built in-image | local FastAPI on `127.0.0.1:8000` |

CI keeps the Space in sync: `.github/workflows/hf-space.yml` stages `apps/web` → `web/`
plus `services/api`, then pushes to the Space, which builds this `Dockerfile`. Developers
only ever edit `apps/web`.

## Deploy tree (assembled by CI at the Space root)

```text
Dockerfile  start.sh  README.md  requirements.txt
web/          ← apps/web (the single frontend source)
services/api/ ← FastAPI backend
scripts/
```

## Secrets / variables (Settings → Variables and secrets)

- `MB_JWT_SECRET` — ≥32-byte random (required for real auth; demo runs in-memory without a DB).
- Optional: `DATABASE_URL` (Aiven `matrix_app` DSN) for persistence; `APP_ENV=production`.

Source: https://github.com/agent-matrix/matrix-builder
