# Matrix Builder — Backend CLI guide (`mb`)

> The fastest way to understand the Matrix Builder backend is to *drive it from the command
> line*. The `mb` CLI is the **local-first mirror of the server control plane**: the same
> "git for AI build contracts" workflow — versions, batches, contract-bound prompts, validation,
> commits, repair, timeline — but offline, deterministic, and with zero infrastructure.
>
> Use this guide to learn the backend model, verify it end to end, and then design the frontend
> against the **same** workflow (every `mb` command maps to a server API endpoint — see
> [CLI ↔ HTTP API map](#cli--http-api-map)).

---

## Two ways to drive the backend

| | `mb` CLI (this guide) | Control-plane HTTP API |
|---|---|---|
| **What** | Local-first Matrix Builder, state in `.mb/` | FastAPI service (`services/api`, `/api/v1/*`) |
| **Persistence** | JSON files on disk (`.mb/`) | Postgres + object storage, owner-scoped RLS |
| **Auth / infra** | None — runs offline | JWT session + Postgres |
| **Who uses it** | Developers, CI, this demo | The web/desktop frontend |
| **Engine** | in-process `agent-generator` SDK | `agent-generator` adapter, same SDK |

Both speak the **identical workflow model** (project → version → batch → prompt → commit →
validation → repair). Learn it once with `mb`; the API is the networked, multi-user version.

---

## Install

`mb` ships with the `agent-generator` engine package:

```bash
pip install agent-generator        # provides both `agent-generator` and `mb`
mb --version                        # e.g. "mb (agent-generator) 1.1.0"
```

No server, no database, no API key is needed for the local loop.

---

## The build loop in 60 seconds

```bash
mb init "A simple hello world web page" --quality standard   # idea → controlled blueprint
mb next "Implement the hello world page"                     # plan the next batch
mb prompt --coder claude-code                                # contract-bound prompt for an AI coder
# … the AI coder edits the allowed files …
mb check backend/app/api/routes.py                           # validate the change set → commit
mb timeline                                                  # the build history
```

Each command is **deterministic** (content-addressed ids, the contract is rebuilt from the same
idea), so a session replays identically on any machine.

---

## Step by step (with real output)

### 1. `mb init` — idea → controlled blueprint

```text
$ mb init "A simple hello world web page" --quality standard
Initialized .mb/ for Standard Matrix Bundle
  project   bp-56d0c6f90021
  version   v1.0.0  ·  quality standard
  blueprint 1 task(s)  ·  stack fastapi/nextjs
  next      mb next "<goal>"
```

Creates the `.mb/` workspace: a controlled blueprint plus the version cursor. `--quality` is one
of `starter | standard | production | enterprise` (more rules at higher tiers).

### 2. `mb next` — plan a batch (one scoped change)

```text
$ mb next "Implement the hello world page"
Batch 01  Implement the hello world page  (add-feature)
  id bat-21c28c959105
  TASK-002: Apply the requested update
    - backend/app/api/routes.py
    - backend/tests/test_routes.py
  acceptance: pytest -q, ruff check ., npm run build
  next      mb prompt --coder claude --copy
```

A **batch** is the unit of change against the current commit. It declares the *allowed files* and
the *acceptance commands* — the contract the AI coder must stay inside.

### 3. `mb prompt` — emit a contract-bound prompt

```text
$ mb prompt --coder claude-code
You are Claude Code, an expert software engineer …
Governing rules: RMD-101, RMD-102, … RMD-120.
End your response with a stop condition (RMD-118):
    MATRIX_STATUS: approved | needs_repair | rejected
  next      mb check --changed <files…>
```

`--coder` ∈ `claude | codex | cursor | gitpilot | ibm-bob | generic`. It also writes tool-native
helper files (e.g. `CLAUDE.md`, `AGENTS.md`) next to the prompt so the coder picks up the
contract automatically. Paste the prompt into your AI coder; it implements **only** the batch.

### 4. `mb check` — validate the change set

The AI coder reports back; you validate what changed. Validation is **fail-closed**:

```text
$ mb check backend/app/api/routes.py          # a file inside the allowlist
MATRIX_STATUS: approved  score=100
  committed mc-454fa2735cd7                    # ← an immutable Matrix Commit is created

$ mb check MATRIX_BLUEPRINT.yaml               # an immutable contract file
MATRIX_STATUS: rejected  score=60
  -  RMD-002: Modified a forbidden contract file: MATRIX_BLUEPRINT.yaml
  next      mb repair --copy
```

**Exit codes** (so CI can gate on it): `0` approved · `1` needs-repair · `2` rejected.

A passing check produces a **Matrix Commit** — an immutable checkpoint (`mc-…`) with the file
manifest, the prompt snapshot, the standards lock, the diff from its parent, and the validation
result. That is the "git for AI" primitive.

### 5. `mb repair` — turn a failure into a scoped fix

```bash
mb repair --copy
```

Reads the last failing validation and emits a **repair prompt** (failing checks + exact paths +
allowed/forbidden roots + acceptance commands) plus a fix-issue batch. Repairs stay scoped — the
coder may only touch what the failure named.

### 6. `mb timeline` — the build history

```text
$ mb timeline
Standard Matrix Bundle  v1.0.0
A simple hello world web page

  Batch 01  Implement the hello world page  (add-feature)
           rejected
           ✓ commit 001 mc-454fa2735cd7
```

Every batch and commit in order — the same data the UI's **Build Timeline** renders.

---

## The `.mb/` workspace

```text
.mb/
  project.json                 # version + cursors (next batch / next commit)
  blueprint.json               # the controlled blueprint (deterministically rebuilt)
  batches/NN/
    batch.json                 # the batch plan + status
    prompts/<coder>.md         # the contract-bound prompt
    prompts/CLAUDE.md          # tool-native helper file(s)
    validation.json            # the last validation report (if checked)
  commits/NNN/
    manifest.json              # the immutable commit manifest
```

This on-disk layout is a 1:1 mirror of the server tables (`projects`, `bundle_versions`,
`build_batches`, `prompt_versions`, `matrix_commits`, `validation_runs`).

---

## Going to the server: `mb login` + `mb sync`

The local loop needs nothing. To push your batches/commits to the **shared backend** (so they
appear on `build.matrixhub.io`, sync across devices, and can be published):

```bash
mb login                       # store a self-issued HS256 session JWT (ADR 0002, no external IdP)
mb sync                        # upsert-by-id: push local batches/commits, pull merged state
mb check --watch <files…>      # run validation server-side and tail the live run-event stream
```

`mb sync` is the bridge between the offline CLI and the control-plane API below.

---

## CLI ↔ HTTP API map

This is the table to design the frontend from: each `mb` action is one control-plane call
(`services/api`, all under `/api/v1`, JWT-authenticated, rows isolated per user via RLS).

| `mb` command | Control-plane endpoint | Powers (UI) |
|---|---|---|
| `mb init` | `POST /projects` → `POST /versions` | New build → blueprint screen |
| `mb timeline` | `GET /versions/{id}/timeline` | Build Timeline |
| `mb next "<goal>"` | `POST /batches` | "Continue build" / next batch |
| `mb prompt --coder X` | `POST /batches/{id}/prompt-pack` | Prompt preview + "Copy prompt" |
| (run the prompt) | `POST /batches/{id}/runs` → `GET /runs/{id}/events` | "I ran this batch" + live run log |
| `mb check <files>` | `POST /batches/{id}/executions` → `GET /validation-runs/{id}` | Submit AI result → Validation Result |
| (commit produced) | `GET /commits/{id}`, `GET /commits/{id}/diff`, `GET /commits/{id}/artifacts` | Commit detail + diff + download |
| `mb repair` | `POST /repair-batches` | "Create repair batch" |
| `mb sync` | `POST /sync` | Local ↔ cloud bundle sync |
| (publish) | `POST /bundles/{id}/publish-to-matrixhub` | Publish to MatrixHub (validated only) |
| standards | `GET /standards/current` | Active signed standards pack |

> **Frontend note.** Today the web UI persists "My Builds" in browser `localStorage`. The
> endpoints above are the server-side replacement; wiring the UI to them (swapping
> `apps/web/src/lib/builds-store.ts`) is the planned next step. This guide exists so that
> swap targets a backend we have already proven end to end.

---

## Verify it works (demo script)

A self-checking walkthrough lives at [`scripts/mb_cli_demo.sh`](../scripts/mb_cli_demo.sh). It
runs the whole loop in a throwaway directory and asserts each step (init → next → prompt →
approved-check → rejected-check → timeline):

```bash
bash scripts/mb_cli_demo.sh
# → prints a ✓/✗ per step; exit 0 only if the backend behaves 100% correctly
```

Run it after any backend change to confirm the engine + contract still hold before touching the
frontend.

---

## Command reference

| Command | Purpose |
|---|---|
| `mb init <idea> [--quality] [--title] [--force]` | Idea → controlled blueprint + `.mb/` |
| `mb next "<goal>"` | Plan the next batch in the current version |
| `mb prompt [--coder] [--batch] [--copy] [--file] [--no-helpers]` | Render the contract-bound prompt + helper files |
| `mb check [files…] [--changed] [--repo] [--batch] [--watch]` | Validate a change set (exit 0/1/2) |
| `mb repair [--copy]` | Repair prompt + fix-issue batch from the last failure |
| `mb timeline` | Show every batch + commit in order |
| `mb login` / `mb sync` | Authenticate and sync local ↔ server |
| `mb mcp` | Expose the build loop as MCP tools |

See also: [`e2e-quality-check.md`](./e2e-quality-check.md) (cross-service health),
[`api-reference.md`](./api-reference.md) (full HTTP surface),
[`ai-coder-contract.md`](./ai-coder-contract.md) (the contract model).
