# Matrix Builder — TODO (frontend ↔ control-plane wiring & gaps)

> **The one-line state of the world:** the "git for AI" backend is **built and deployed**
> (`services/api/app/api/workflow.py` over `WorkflowService`, migrations `0001–0004`, owner-scoped
> RLS), and the local `mb` CLI proves the whole loop end to end. **But the web UI does not use it**
> — `apps/web` persists "My Builds" to browser `localStorage`. Closing that gap is the work that
> turns the product from "local-per-browser" into true, cross-device, multi-user "git for AI".
>
> Verify the backend anytime with: `bash scripts/mb_cli_demo.sh` (8/8) — see `docs/backend-cli.md`.

---

## P0 — Wire the live UI to the control plane (the headline gap) 🔴

**Goal:** the `/matrix-builder` product reads/writes the server control plane instead of
`localStorage`, so builds persist server-side, sync across devices, and exercise the real commit
graph / diffs / validation runs.

### What exists today
- ✅ Backend: full workflow API at `/api/v1/*` (see the [CLI ↔ API map](docs/backend-cli.md)).
- ✅ A **partial** typed client: `apps/web/src/lib/workflow-client.ts`
  (`getVersion, getTimeline, createBatch, generatePromptPack, getValidationRun, getRunEvents,
  createRepairBatch, fetchThumbnail`).
- ⚠️ That client is **only used by the dead `/builder/*` pages**, not the live `/matrix-builder`.
- 🔴 The live product uses `apps/web/src/lib/builds-store.ts` (localStorage) in
  `MatrixBuilderClient.tsx`, `builds/page.tsx`, and `builds/[id]/page.tsx`.

### Tasks
- [ ] **Complete `workflow-client.ts`** to cover every endpoint the UI needs (thread `authHeaders()`
      from `lib/auth-token.ts`, base = `apiBaseUrl` from `lib/api-client.ts`):
  - [ ] `createProject`, `listProjects`, `getProject` → `POST/GET /projects`, `GET /projects/{id}`
  - [ ] `createVersion` → `POST /versions`
  - [ ] `getCommit`, `getCommitDiff`, `listCommitArtifacts` → `GET /commits/{id}[/diff|/artifacts]`
  - [ ] `enqueueRun` → `POST /batches/{id}/runs` (202) + stream `GET /runs/{id}/events?after=`
  - [ ] `submitExecution` → `POST /batches/{id}/executions` (the "Submit AI result" → validation)
  - [ ] `sync` → `POST /sync` (optional, for `mb`-parity)
  - [ ] bundle ops as needed → `/bundles/{id}/{save,download,manifest,tree,publish-to-matrixhub}`
- [ ] **Define the type mapping** `SavedBuild ⇄ {ProjectResponse, VersionResponse}` in one place
      so screens don't care about the source. (Project = the build; latest Version = current state.)
- [ ] **Swap the data source screen by screen** (keep `builds-store.ts` as the *guest/offline*
      fallback — see the guest task below):
  - [ ] `builds/page.tsx` (My Builds grid): `listBuilds()` → `listProjects()` (+ latest version).
  - [ ] `builds/[id]/page.tsx` (open a build): reconstruct from `getProject` + `getVersion` +
        `getTimeline` instead of `getBuild()` localStorage.
  - [ ] `MatrixBuilderClient.tsx`:
        - choose candidate → `createProject` + `createVersion` (was `saveBuildProgress` draft)
        - "Continue build" / next batch → `createBatch`
        - prompt preview → `generatePromptPack`
        - "I ran this batch" → `enqueueRun` + tail `getRunEvents` (live run log)
        - "Submit AI result" / "Check AI output" → `submitExecution` → `getValidationRun`
        - validation pass → real Matrix Commit (`getCommit`); "View timeline" → `getTimeline`
        - "Create repair batch" → `createRepairBatch`
- [ ] **Loading / error / empty states** for every async call (the localStorage version was
      synchronous; the API is not). Add skeletons + retry + toasts.
- [ ] **Optimistic UX where safe** (e.g. create batch) so the UI stays snappy.
- [ ] **One-time migration**: on first authenticated load, offer to push existing
      `mb:builds:v1:*` localStorage builds to the server (or just drop them — decide).
- [ ] **Keep `docs/backend-cli.md` CLI↔API map in sync** as the source of truth for the wiring.

### ⚠️ Identity seam to verify first (blocker)
- [ ] The session JWT `sub` is `account:<id>` (from `auth_accounts`), while workflow tables key on
      `users.id` (separate UUID, FK on `owner_id`/`created_by`). Confirm `get_workflow_service`
      maps the authenticated identity to a real `users` row (upsert a `users` row on first
      workflow call, or the FK insert will fail). This must work before any P0 write succeeds.

### Definition of done (P0)
- A signed-in user creates a build in the browser, signs in on another device, and **sees the same
  build, timeline, prompts, commits, and diffs** (no localStorage involved).
- `GET /api/v1/projects` returns their builds; the commit graph is real (parent lineage + diffs).

---

## P1 — Backend completeness (so the wired UI is fully featured)

- [ ] **Guest → account claim.** No server-side migration of guest builds today. Either: keep
      guests on `builds-store.ts` (localStorage) and claim into the account on sign-in
      (`POST /guest/claim` style), or make guests first-class with a `guest_sessions` table.
      Decide and implement.
- [ ] **`provider_calls` cost/usage ledger** — new table + migration `0005`: per-batch
      `provider, model, input_tokens, output_tokens, latency_ms, estimated_cost_usd`. Wire the
      `agent-generator` adapter to record it. (Needed for quotas/billing later.)
- [ ] **Real `git diff`.** `WorkflowService.diff_commits` compares manifests, not a worktree.
      Move to a real `git diff` for clean GitHub sync later (keep the manifest delta as a fast path).
- [ ] **`repo_links` / `repo_snapshots` tables** (migration `0005`/`0006`) to back the existing
      `POST /repository` + `/sync` endpoints with persisted GitHub/GitLab links + mirrored states
      (drift detection vs a Matrix Commit).
- [ ] **WebSocket run stream.** `GET /runs/{id}/events` is poll-only; add the WS upgrade for a
      live run log (the UI's "I ran this batch" experience).
- [ ] **Batch approve/cancel** endpoints if the UX needs an explicit approval step
      (today: create → execute → commit; no separate approve/cancel route).

---

## P2 — Scale & teams (only when needed)

- [ ] **`workspaces` / `workspace_members`** — multi-user/teams (today single-owner via `owner_id`).
- [ ] **Durable workflow engine** (Temporal or Redis-backed workers) for long-running
      batch/validation/repair with retries — current execution is synchronous via the adapter.
- [ ] **`standards_packs` DB registry** — today standards load from vendored signed packs; a DB
      table would let the UI show/select pack versions.

---

## Cleanup / consistency

- [ ] **Decommission the dead `/builder/*` island.** `apps/web/src/app/builder/{timeline,validation,
      continue,bundle,candidates,validate}` is an older, light-themed workflow UI, unlinked from the
      live product, that owns the light `.tl-grid` CSS we had to scope around. Either delete it or
      fold its (already-correct) `workflow-client` usage into the live `/matrix-builder` screens.
- [ ] After P0, **remove the light timeline CSS** (`.tl-grid .tl-*`, `.wf-*`, `.vr-*`,
      `.tl-version*`, `.tl-ic`, `.tl-review` in `styles/matrix-builder.css`) once `/builder/*` is gone.
- [ ] **Regenerate the typed client** from OpenAPI (`scripts/generate_client_sdk.py` /
      `generate_openapi.py`) so `workflow-client.ts` stays in lockstep with the API.

---

## Standing ops / go-live (not code — operator actions)

- [ ] **Merge `claude/confident-einstein-fz3hcy` → `master`** so Vercel (`build.matrixhub.io`)
      and the HF Space ship all of this session's work (auth, builds, timeline colors/nav, intro site).
- [ ] **Enable GitHub Pages** (Settings → Pages → Source = "GitHub Actions") so
      `agent-matrix.github.io/matrix-builder/` serves the `site/` intro pages (the footer "Docs"
      link already points there). Workflow: `.github/workflows/pages.yml`.
- [ ] **Run the `db-migrate` workflow** against Aiven (migrations `0001–0004` + future `0005`),
      and set `AIVEN_KEEPALIVE_DATABASE_URL`.
- [ ] **Verify Resend domain** (`matrixhub.io`) + set `EMAIL_FROM`; confirm `RESEND_API_KEY` secret.
- [ ] **Rotate the credentials** pasted in chat earlier (avnadmin Postgres + `re_…` Resend key).

---

## Quick reference

- **Backend loop, proven:** `bash scripts/mb_cli_demo.sh` · **guide:** `docs/backend-cli.md`
- **CLI ↔ HTTP API map:** `docs/backend-cli.md` (the wiring blueprint for P0)
- **Control plane:** `services/api/app/api/workflow.py` + `app/services/workflow_service.py`
- **What to replace:** `apps/web/src/lib/builds-store.ts` (localStorage) → `lib/workflow-client.ts` (API)
- **Intro site:** `site/{index,use/index,bundle/index}.html` (deploys via `pages.yml`)
