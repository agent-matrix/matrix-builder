# Developer guide

Everything technical for building, running, and integrating Matrix Builder. The
[README](../README.md) stays product-focused; this is the engineering entry point.

## Requirements
- Python 3.11+
- Node.js 20+
- Docker (optional, for `make dev`)
- `uv` (fast installs; `make install` falls back to pip) and `pnpm` for the web workspace

## Quick start
```bash
cp .env.example .env
make install          # Python deps (uv) + frontend deps (pnpm)
make test             # services + api + workers
make lint             # repo structure, secrets, style, contracts, frontend
make dev              # Docker Compose dev stack   (or: make api-dev for backend only)
```

## Commands
```bash
make help            # list commands
make doctor          # check local tools and repo files
make install         # install Python + frontend dependencies
make migrate         # apply Alembic migrations (Aiven: set MIGRATION_DATABASE_URL)
make test            # run tests
make lint            # static checks
make format          # normalize whitespace
make openapi         # regenerate packages/contracts/openapi.json
make security        # repo security checks
make sbom            # release SBOM
make checksums       # release checksums
make release-checks  # test + lint + security + sbom + checksums
make dev / make down # start / stop the Docker dev stack
make clean           # remove caches
```

## Architecture
```text
ruslanmv.com /matrix-builder  →  Matrix Builder web (Next.js)
        →  Matrix Builder API (FastAPI, /v1 + WebSocket)
        →  agent-generator engine
        →  matrix-definitions standards pack
        →  Matrix Bundle + prompt packs + validation reports
        →  MatrixHub publication
```
Persistence: **Aiven PostgreSQL** with per-user row-level security (see
[aiven.md](aiven.md)). Deploy: one Docker container on **Hugging Face Spaces**
(see [deploy-huggingface.md](deploy-huggingface.md)). Going live for free
(`builder.matrixhub.io` on Vercel → same-origin rewrites → HF Spaces):
[go-live.md](go-live.md). Roadmap +
status: [BATCH_BACKLOG.md](BATCH_BACKLOG.md) / [PROJECT_STATUS_AND_STRATEGY.md](PROJECT_STATUS_AND_STRATEGY.md).

## First user flow
```text
Describe idea → 3 blueprint candidates → choose one → generate Matrix Bundle
→ copy the prompt for Claude Code / Codex / Cursor / GitPilot / IBM Bob
→ build under contract → validate → (optionally) publish to MatrixHub
```

## Matrix Bundle contents
A Matrix Bundle is a controlled build **contract**, not just code:
```text
MATRIX_BLUEPRINT.yaml  MATRIX_STANDARDS.lock  MATRIX_TASKS.md
MATRIX_ALLOWED_CHANGES.md  MATRIX_ACCEPTANCE_CRITERIA.md  MATRIX_VALIDATION.md
docs/architecture.md  docs/security.md  docs/standards-report.md
coder-prompts/{claude-code,codex-chatgpt,cursor,gitpilot,ibm-bob,generic-ai-coder}.md
artifacts/manifest.json  artifacts/checksums.txt
```

## API overview
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | liveness |
| `GET` | `/api/v1/ready` | readiness + adapter/standards status |
| `POST` | `/api/v1/ideas/parse` | normalize an idea |
| `POST` | `/api/v1/blueprints/candidates` | blueprint candidates |
| `POST` | `/api/v1/blueprints` | controlled blueprint |
| `POST` | `/api/v1/bundles` | generate a Matrix Bundle |
| `GET` | `/api/v1/bundles/{id}` · `/download` · `/prompt/{coder}` | read / download / prompt |
| `POST` | `/api/v1/bundles/{id}/validate` · `/api/v1/validation/patch` | validate |
| `POST` | `/api/v1/sync` | upsert a local `.mb/` workspace (CLI sync) |
| `*` | `/api/v1/{projects,versions,batches,commits,validation-runs,repair-batches}` | workflow API |
| `WS` | `/api/v1/ws/runs/{id}` | live run-event stream |
| `POST` | `/api/v1/publications/matrixhub/{id}` | MatrixHub dry-run publish |
| `GET` | `/metrics` | Prometheus metrics |

Full reference: [api-reference.md](api-reference.md). Regenerate the draft with `make openapi`.

## Integrations
- [ai-coder-contract.md](ai-coder-contract.md) — why AI coders are workers, not architects
- [ai-coder-prompt-system.md](ai-coder-prompt-system.md) — per-coder prompt adapters
- [gitpilot-integration.md](gitpilot-integration.md) — GitPilot native (`.gitpilotrules`) flow
- [agent-generator-integration.md](agent-generator-integration.md) — the generation engine boundary
- [matrix-definitions-integration.md](matrix-definitions-integration.md) — the signed standards boundary
- [matrixhub-integration.md](matrixhub-integration.md) — the publish/trust gate

## Examples
```text
examples/{ideas,blueprints,prompts,bundles,validation}/
```
Flagship: a **GitHub Repo Intelligence Agent** generated as a controlled Matrix Bundle.

## Control principle
```text
matrix-builder orchestrates · agent-generator generates · matrix-definitions rules
MatrixHub publishes only validated bundles · AI coders are workers, not architects
```

## Marketing screenshots (maintainers)
Product screenshots are generated from the live app, not committed to the README. To refresh:
```bash
cd apps/web && pnpm install && pnpm dev          # http://localhost:3000
python -m pip install playwright && python -m playwright install --with-deps chromium
python apps/web/scripts/shoot.py --base-url http://localhost:3000 --out docs/assets/screenshots
```
Retina (2880×1800), dark by default; `--light` for light mode.
