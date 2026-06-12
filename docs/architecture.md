# Matrix Builder Architecture

Matrix Builder is intentionally not a code generator by itself. It is the public control plane and user experience for controlled software generation.

## Core boundary

```text
matrix-builder does orchestration.
agent-generator does generation.
matrix-definitions provides rules.
MatrixHub publishes validated artifacts.
ruslanmv.com explains and promotes the standard.
```

## Runtime flow

```text
User
  ↓
ruslanmv.com /matrix-builder
  ↓
Next.js Matrix Builder UI
  ↓
FastAPI Matrix Builder API
  ↓
agent-generator adapter
  ↓
agent-generator engine
  ↓
matrix-definitions standards pack
  ↓
Matrix Bundle ZIP + prompts + validation report
  ↓
MatrixHub dry-run / publish
```

## Repository layers

| Layer | Path | Responsibility |
|---|---|---|
| Web app | `apps/web/` | Product page, idea form, scanning state, candidates, Matrix Bundle UI, copy prompt UI |
| API service | `services/api/` | FastAPI orchestration, endpoints, schemas, services, integration boundaries |
| Workers | `workers/` | Async generation, validation, publication, cleanup boundaries |
| Contracts | `packages/contracts/` | JSON Schemas, examples, OpenAPI draft |
| Client SDK | `packages/client-sdk/` | Future TypeScript SDK for the public API |
| UI package | `packages/ui/` | Shared design primitives |
| Examples | `examples/` | Blueprints, prompts, bundles, validation reports, screenshots |
| Docs | `docs/` | Product, engineering, API, launch, integration, and promotion docs |
| Infra | `infra/` | Docker, Helm, local services, deployment templates |

## Data model

| Model | Purpose |
|---|---|
| `IdeaRequest` | Raw user idea plus build type, goal, and preferred coder |
| `BlueprintCandidate` | One proposed implementation path such as Minimal, Standard, Production |
| `BlueprintResult` | Selected controlled blueprint returned by the engine adapter |
| `MatrixBundle` | User-facing controlled ZIP package with files, prompts, metadata, expiration, and validation state |
| `PromptPack` | Coder-specific prompts generated from the same bundle contract |
| `ValidationReport` | Approved / needs-repair / rejected result with violations and repair prompt |
| `Publication` | MatrixHub dry-run or publish result |

## Control files

The Matrix Bundle must contain:

```text
MATRIX_BLUEPRINT.yaml
MATRIX_STANDARDS.lock
MATRIX_TASKS.md
MATRIX_ALLOWED_CHANGES.md
MATRIX_ACCEPTANCE_CRITERIA.md
MATRIX_VALIDATION.md
```

These files define what the AI coder may do. They are control files and must not be edited by the AI coder unless a human starts a new blueprint version.

## Why this architecture matters

Normal AI-coder workflows are often:

```text
vague prompt → uncontrolled code → manual cleanup
```

Matrix Builder changes the workflow:

```text
idea → blueprint → standards lock → Matrix Bundle → controlled prompt → validation → repair or publish
```

The product is simple on the surface and strict underneath.
