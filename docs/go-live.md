# Go-live: free-first deployment

How Matrix Builder ships to real users for **$0** today, with a clean upgrade path to a
production backend later. This is the design + runbook; the HF container details live in
[deploy-huggingface.md](deploy-huggingface.md), persistence in [aiven.md](aiven.md).

## The decision

**One new public URL — `build.matrixhub.io` — served by Vercel.** The Next.js app
proxies every backend through same-origin `/api/*` rewrites to free Hugging Face Spaces.

Why this and not the alternatives:

- **No new gateway, no CORS.** The browser only ever talks to `build.matrixhub.io`.
  Rewrites run server-side on Vercel; backends stay on `*.hf.space` but are never exposed.
- **Free.** Vercel Hobby + HF free Spaces. HF custom domains need a paid plan, so we
  proxy the raw Space hosts instead of pointing DNS at them.
- **agent-generator is already on HF** — we reuse it as-is, no redeploy.
- **No protocol surprises.** The validation UI polls `/api/v1/runs/{id}/events`
  (`getRunEvents`), so there is **no WebSocket** to tunnel through the proxy at launch.

```text
                         build.matrixhub.io  (Vercel, Next.js)
  browser ──────────────►  /                      app shell + pages
                           /api/builder/*       ─► ruslanmv-matrix-builder.hf.space
                           /api/agent-generator/* ─► ruslanmv-agent-generator.hf.space
                           /api/ollabridge/*    ─► ruslanmv-ollabridge.hf.space  (GitPilot LLM)
```

The frontend itself calls only `/api/builder` (`NEXT_PUBLIC_API_BASE_URL`). The
`agent-generator` and `ollabridge` rewrites put those services on the same origin for the
CLI, GitPilot, and future clients.

## Domain map

| Host | Role | Status |
|---|---|---|
| `www.matrixhub.io` | marketing site + `/definitions` (the signed standard) | existing — **don't touch** |
| `build.matrixhub.io` | Matrix Builder app (this deploy) | **new** |
| `admin.matrixhub.io` | admin console | reserved (existing) |
| `api.matrixhub.io` | dedicated production backend | reserved (Phase 3) |
| `runtime.matrixhub.io` | enterprise dedicated inference (`agent-matrix/matrix-runtime`) | reserved (Phase 4) |
| `send.matrixhub.io` | unrelated | **don't touch** |
| ~~`cloud.matrixhub.io`~~ | already taken — **do not use** | — |

The standard stays at `www.matrixhub.io/definitions` — no new domain for it.

## LLM inference (GitPilot)

- **Free / community:** GitPilot inference goes through **OllaBridge Cloud**
  (`ruslanmv-ollabridge.hf.space`), reached via `/api/ollabridge/*`.
- **Enterprise:** dedicated inference from OllaBridge on `runtime.matrixhub.io` (Phase 4).

## DNS

Add one record (the existing matrixhub.io records stay as-is):

```text
build.matrixhub.io   CNAME   <builder-vercel-project>.vercel-dns-017.com   (DNS only / not proxied)
```

Vercel shows the exact target when you add the domain to the project; use that value.

## One frontend source, two homes

`apps/web` is the **only** frontend codebase. The same source runs on Vercel (production
UI) and inside the HF Space (full-stack demo) — never copied or forked by hand:

| Home | Builds from | Backend it talks to |
|---|---|---|
| **Vercel** `build.matrixhub.io` | `apps/web` (root dir) | rewrites `/api/builder/*` → the HF Space's public `/api/builder` |
| **HF Space** `ruslanmv-matrix-builder.hf.space` | `apps/web` staged as `web/` by CI, built in-image | local FastAPI on `127.0.0.1:8000` |

`next.config.ts` resolves `rewrites()` at **build time** into the routes manifest, so the
only difference between the two is the `MATRIX_BUILDER_SPACE_URL` present at build:
the Vercel default (`…hf.space/api/builder`) vs the HF Dockerfile's `http://127.0.0.1:8000`.
CI (`.github/workflows/hf-space.yml`) rebuilds the Space from `apps/web` on every push.

## Vercel project settings

- **Root directory:** `apps/web`
- **Framework preset:** Next.js (rewrites come from `next.config.ts` — no `vercel.json` needed)
- **Environment variables:** none required — the defaults in `next.config.ts` /
  `apps/web/.env.example` already point at the HF Space's public API. Override only for
  staging (`MATRIX_BUILDER_SPACE_URL`, `AGENT_GENERATOR_SPACE_URL`, `OLLABRIDGE_SPACE_URL`).

## HF Space (full stack)

The Space runs the Next.js UI (port 7860) with FastAPI behind it — see [`hf/`](../hf/) and
[deploy-huggingface.md](deploy-huggingface.md). Live now at
`https://ruslanmv-matrix-builder.hf.space`. Demo mode uses in-memory storage; set Space
secrets `MB_JWT_SECRET` (≥32 bytes) and optional `DATABASE_URL` (Aiven `matrix_app`) for
persistence. To enable CI auto-deploy, add the repo secret `HF_TOKEN` (write scope on the Space).

## Phases

- **Phase 0 — Prep.** Don't change existing matrixhub.io DNS. Create the Vercel project from
  `apps/web`; deploy the matrix-builder HF Space.
- **Phase 1 — Free launch (this doc).** `build.matrixhub.io` on Vercel → same-origin
  rewrites → HF Spaces. DB = SQLite demo *or* Aiven `matrix_app`. Polling, no WS.
- **Phase 2 — Beta.** Aiven persistence + per-user RLS + real `MB_JWT_SECRET`; quotas on.
- **Phase 3 — Production backend.** Move the API to `api.matrixhub.io` (own infra/container);
  repoint `MATRIX_BUILDER_SPACE_URL` (or the rewrite) there. Frontend unchanged.
- **Phase 4 — Enterprise.** Dedicated inference on `runtime.matrixhub.io`
  (`agent-matrix/matrix-runtime`); enterprise tenants get isolated OllaBridge capacity.

## Operator checklist

1. Enable GitHub Pages for `matrix-definitions` (Settings → Pages → Source: GitHub Actions)
   so `www.matrixhub.io/definitions` publishes.
2. Deploy the matrix-builder HF Space; set `DATABASE_URL` + `MB_JWT_SECRET` secrets.
3. Create the Vercel project (root `apps/web`); set the env vars above.
4. Add `build.matrixhub.io` to the Vercel project; create the `CNAME` from the DNS section.
5. Verify: `https://build.matrixhub.io` loads, and
   `https://build.matrixhub.io/api/builder/health` returns the backend health payload.
