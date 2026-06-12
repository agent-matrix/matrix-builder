# Matrix Builder

**Matrix Builder gives AI coders a contract, not a prompt.**

Matrix Builder is the public product and orchestration layer for controlled AI-assisted software creation by **Ruslan Magana**. Developers describe an idea, choose a blueprint, receive a controlled **Matrix Bundle**, and then copy a contract-aware prompt into Claude Code, Codex / ChatGPT, GitPilot, IBM Bob, Cursor, or a generic AI coder.

The product is intentionally simple for the developer and strict for the AI coder:

```text
Developer: describe idea → choose blueprint → copy prompt or download ZIP.
AI coder: read the Matrix Bundle → edit only allowed files → pass validation.
```

## Ecosystem

| Product | Responsibility |
|---|---|
| **Matrix Builder** | Public UX, API orchestration, bundle sharing, validation display, MatrixHub publishing action |
| **agent-generator** | Internal engine for idea parsing, blueprint candidates, scaffold generation, prompt packs, validation, repair prompts, ZIP export |
| **matrix-definitions** | Signed standards, Ruslan Magana Definitions, quality profiles, control rules, MatrixHub publication rules |
| **MatrixHub / matrixhub.io** | Registry for validated blueprints, Matrix Bundles, prompt packs, and remixable templates |
| **GitPilot by RuslanMV** | First-class controlled AI-coder path for Matrix Bundles |
| **ruslanmv.com** | Public authority platform and product doorway for Ruslan Magana |

## Batch status

This repository is currently at **Batch 9 — Docs, examples, and Ruslan Magana promotion**.

Implemented so far:

- Production-style repository foundation with Makefile, CI, Docker dev environment, quality gates, security policy, contribution guide, and CODEOWNERS
- Scout-inspired Next.js `/matrix-builder` product page with idea input, scanning, candidates, Matrix Bundle result, prompt copy, ZIP UI, and send-to-coder panel
- Strict contract schemas, example payloads, Pydantic models, TypeScript types, SDK exports, and OpenAPI generation
- FastAPI orchestration service with health, readiness, ideas, blueprint candidates, blueprint generation, bundle generation, prompts, standards, validation, publications, auth/session foundation, audit, and metrics endpoints
- Clean `agent_generator_adapter.py` boundary so Matrix Builder orchestrates and `agent-generator` generates
- `matrix_definitions_client.py` boundary so standards and Ruslan Magana Definitions remain external and signed
- Matrix Bundle service with manifest, file tree, ZIP generation, signed download URL, guest expiration, save flow, quota service, and cleanup job
- AI-coder prompt system for Claude Code, Codex / ChatGPT, GitPilot, IBM Bob, Cursor, and generic AI coders
- Validation, repair prompt generation, drift detection adapter, forbidden file change detection, dependency drift detection, standards-lock verification, and MatrixHub dry-run publishing
- Security, observability, deployment, release workflow, SBOM, checksums, and security scan foundations
- Complete documentation, examples, public copy, Ruslan Magana Definitions page content, SEO metadata, and example screenshots

## Product architecture

```text
ruslanmv.com /matrix-builder
        ↓
Matrix Builder web UI
        ↓
Matrix Builder API
        ↓
agent-generator engine
        ↓
matrix-definitions standards pack
        ↓
Matrix Bundle + prompt packs + validation reports
        ↓
MatrixHub publication
```

## First user flow

```text
Describe idea
→ get 3 blueprint candidates
→ choose one
→ generate Matrix Bundle
→ copy prompt for Claude Code / Codex / GitPilot / IBM Bob / Cursor
→ download ZIP
→ validate result
→ optionally publish to MatrixHub
```

## Matrix Bundle contents

A Matrix Bundle is not just generated code. It is a controlled build contract:

```text
README.md
MATRIX_BLUEPRINT.yaml
MATRIX_STANDARDS.lock
MATRIX_TASKS.md
MATRIX_ALLOWED_CHANGES.md
MATRIX_ACCEPTANCE_CRITERIA.md
MATRIX_VALIDATION.md
docs/architecture.md
docs/security.md
docs/standards-report.md
coder-prompts/claude-code.md
coder-prompts/codex-chatgpt.md
coder-prompts/cursor.md
coder-prompts/gitpilot.md
coder-prompts/ibm-bob.md
coder-prompts/generic-ai-coder.md
coder-prompts/prompt-pack.json
artifacts/manifest.json
artifacts/checksums.txt
```

## Quick start

Requirements:

- Python 3.11+
- Node.js 20+
- Docker Desktop or compatible Docker engine for `make dev`
- Optional: `pnpm` for frontend workspace development

```bash
cp .env.example .env
make doctor
make test
make lint
make dev
```

`make dev` starts the Docker-based development stack. For a local-only backend smoke run:

```bash
make api-dev
```

## Commands

```bash
make help            # Show available commands
make doctor          # Check required local tools and repository files
make test            # Run Python tests and contract checks
make lint            # Run repository, Python, contract, and frontend static checks
make format          # Normalize whitespace in tracked source files
make openapi         # Regenerate packages/contracts/openapi.json
make security        # Run repository security checks
make sbom            # Generate release SBOM placeholder
make checksums       # Generate release checksums
make release-checks  # Run test + lint + security + SBOM + checksums
make dev             # Start Docker Compose development stack
make down            # Stop Docker Compose development stack
make clean           # Remove local caches
```

## API overview

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Root liveness check |
| `GET` | `/api/v1/ready` | Readiness plus adapter/standards status |
| `POST` | `/api/v1/ideas/parse` | Normalize raw idea into structured intent |
| `POST` | `/api/v1/blueprints/candidates` | Generate blueprint candidates |
| `POST` | `/api/v1/blueprints` | Generate a controlled blueprint |
| `POST` | `/api/v1/bundles` | Generate a Matrix Bundle |
| `GET` | `/api/v1/bundles/{bundle_id}` | Read bundle metadata |
| `GET` | `/api/v1/bundles/{bundle_id}/download` | Download bundle ZIP |
| `GET` | `/api/v1/bundles/{bundle_id}/prompt/{coder}` | Read a coder-specific controlled prompt |
| `POST` | `/api/v1/bundles/{bundle_id}/validate` | Validate bundle output |
| `POST` | `/api/v1/validation/patch` | Validate an AI-coder patch |
| `POST` | `/api/v1/publications/matrixhub/{bundle_id}` | MatrixHub dry-run publication |
| `GET` | `/api/v1/standards/current` | Read active matrix-definitions status |
| `GET` | `/metrics` | Prometheus metrics |

Regenerate the OpenAPI draft with:

```bash
make openapi
```

## Documentation map

| Document | Purpose |
|---|---|
| `docs/developer-quickstart.md` | Start here as a new developer |
| `docs/architecture.md` | System architecture and repo boundaries |
| `docs/api-reference.md` | API routes, payloads, and examples |
| `docs/bundle-service.md` | Matrix Bundle model, storage, ZIPs, and expiration |
| `docs/ai-coder-contract.md` | Why AI coders are workers, not architects |
| `docs/ai-coder-prompt-system.md` | Prompt adapters for Claude Code, Codex, GitPilot, IBM Bob, Cursor, generic |
| `docs/gitpilot-integration.md` | GitPilot-specific controlled build flow |
| `docs/agent-generator-integration.md` | Adapter boundary with `agent-generator` |
| `docs/matrix-definitions-integration.md` | Standards pack and Ruslan Magana Definitions boundary |
| `docs/matrixhub-integration.md` | MatrixHub publishing and trust gate |
| `docs/marketing-copy.md` | Public launch copy for ruslanmv.com and matrixhub.io |
| `docs/ruslan-magana-definitions-page.md` | Content draft for the public RMD page |
| `docs/seo-metadata.md` | SEO titles, descriptions, routes, and schema ideas |

## Examples

```text
examples/ideas/
examples/blueprints/
examples/prompts/
examples/bundles/
examples/validation/
examples/screenshots/
```

The examples show the intended flagship flow: a **GitHub Repo Intelligence Agent** generated as a controlled Matrix Bundle and implemented by an AI coder under contract.

## Control principle

```text
matrix-builder does orchestration.
agent-generator does generation.
matrix-definitions provides rules.
MatrixHub publishes only validated, controlled bundles.
AI coders are workers, not architects.
```

## Brand positioning

Use this exact message for the public product:

> **Matrix Builder gives AI coders a contract, not a prompt.**

Supporting line:

> Describe your idea. Get a controlled blueprint, Matrix Bundle, and copy-paste prompts for the AI coder you already use.

## License

This scaffold uses the MIT License until the final product licensing decision is made.
