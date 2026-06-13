# Matrix ecosystem — E2E quality check

A single, repeatable test that proves the **whole program works across its live services** by
generating the canonical *"hello world web page"* end to end. Run it in CI, in a sandbox, or
locally before/after a release — it is the project's **standard quality gate**.

## What it verifies

| # | Service | Check |
|---|---------|-------|
| 1 | **matrix-builder** | UI (`/matrix-builder`) + API health + `auth status` (Google + email enabled) |
| 2 | **agent-generator** | `/api/health`; `POST /api/plan` returns a `ProjectSpec`; `POST /api/generate` returns real files |
| 3 | **gitpilot** | backend `/api/health` → `{"status":"healthy"}` |
| 4 | **wiring** | matrix-builder's `/api/agent-generator/*` proxy reaches agent-generator (services connected) |

A pass means: *idea → matrix-builder → (proxy) → agent-generator produces a working project*, and
the AI-coder backend (gitpilot) is live.

## Run it

```bash
bash scripts/e2e_ecosystem_check.sh
```

Override targets (e.g. test the production domain or a staging Space):

```bash
MB=https://build.matrixhub.io \
AG=https://ruslanmv-agent-generator.hf.space \
GP=https://ruslanmv-gitpilot.hf.space \
PROMPT="A simple hello world web page" \
bash scripts/e2e_ecosystem_check.sh
```

**Requirements:** `bash`, `curl`, `python3` (standard in CI/sandboxes — no extra installs).
**Exit code:** `0` if every check passes, `1` otherwise (CI-friendly).

## Expected output

```text
1. matrix-builder (control plane + UI)
  ✓ UI /matrix-builder (200)
  ✓ API /api/builder/health (200)
  ✓ auth status (google+email) — google=True email=True
2. agent-generator (generation engine)
  ✓ health /api/health (200)
  ✓ plan: 'A simple hello world web page' — name=hello-world-web framework=crewai
  ✓ generate produces files — 4 files: src/.../main.py, src/.../__init__.py, README.md, requirements.txt
3. gitpilot (AI coder backend)
  ✓ backend health — healthy (gitpilot-backend)
4. wiring: matrix-builder → agent-generator (same-origin proxy)
  ✓ proxy /api/agent-generator/api/health (200)
  ✓ full chain: plan via matrix-builder — name=hello-world-web
Result
  9 passed, 0 failed
E2E quality check PASSED
```

## Default targets

| Var | Default |
|-----|---------|
| `MB` | `https://ruslanmv-matrix-builder.hf.space` |
| `AG` | `https://ruslanmv-agent-generator.hf.space` |
| `GP` | `https://ruslanmv-gitpilot.hf.space` |
| `PROMPT` | `A simple hello world web page` |
| `TIMEOUT` | `90` (seconds per request) |

## For an AI coder reproducing this in a sandbox

1. Ensure outbound HTTPS (port 443) to `*.hf.space` (and `build.matrixhub.io`) is allowed.
2. `bash scripts/e2e_ecosystem_check.sh` — read the `✓/✗` per check.
3. If a check fails, the line shows the HTTP status / reason. Common causes:
   - **matrix-builder 404/timeouts** → the HF Space is sleeping/rebuilding; retry shortly.
   - **agent-generator plan/generate non-200** → the engine Space is down or the request shape
     changed (it expects `{"prompt": "..."}`).
   - **gitpilot unhealthy** → its backend Space is down.
   - **proxy check fails but agent-generator passes** → the matrix-builder rewrite
     (`/api/agent-generator/*`) regressed in `apps/web/next.config.ts`.

## Notes

- gitpilot's full *chat → code* path is interactive (UI + LLM via OllaBridge), so this gate
  asserts its backend is **healthy** rather than scripting a headless coding session.
  agent-generator is the deterministic engine and is exercised fully (plan → generated files).
- The test is **read-only / idempotent** — `plan`/`generate` don't persist anything.
