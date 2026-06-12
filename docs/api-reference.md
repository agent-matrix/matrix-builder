# Matrix Builder API Reference

The Matrix Builder API is a public orchestration API. It does not duplicate `agent-generator`; it calls it through a clean adapter boundary.

## Base URLs

Local development:

```text
http://localhost:8000
```

Planned production:

```text
https://api.ruslanmv.com/matrix-builder
```

## Health and readiness

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Root liveness check |
| `GET` | `/api/v1/health` | Versioned liveness check |
| `GET` | `/api/v1/ready` | Adapter and standards readiness |

## Idea and blueprint endpoints

### Parse idea

```bash
curl -s http://localhost:8000/api/v1/ideas/parse \
  -H 'content-type: application/json' \
  -d '{
    "idea": "Build an AI app that analyzes GitHub repositories",
    "build_type": "agent",
    "goal": "portfolio",
    "preferred_coder": "gitpilot"
  }'
```

### Generate candidates

```bash
curl -s http://localhost:8000/api/v1/blueprints/candidates \
  -H 'content-type: application/json' \
  -d '{
    "idea": "Build an AI app that analyzes GitHub repositories",
    "build_type": "agent",
    "goal": "portfolio",
    "preferred_coder": "gitpilot"
  }'
```

### Generate controlled blueprint

```bash
curl -s http://localhost:8000/api/v1/blueprints/generate \
  -H 'content-type: application/json' \
  -d '{
    "idea_request": {
      "idea": "Build an AI app that analyzes GitHub repositories",
      "build_type": "agent",
      "goal": "portfolio",
      "preferred_coder": "gitpilot"
    },
    "selected_candidate_id": "standard"
  }'
```

## Bundle endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/bundles` | Generate a Matrix Bundle |
| `GET` | `/api/v1/bundles/{bundle_id}` | Read bundle metadata |
| `GET` | `/api/v1/bundles/{bundle_id}/manifest` | Read manifest metadata |
| `GET` | `/api/v1/bundles/{bundle_id}/tree` | Read file tree |
| `GET` | `/api/v1/bundles/{bundle_id}/download` | Download ZIP |
| `POST` | `/api/v1/bundles/{bundle_id}/signed-url` | Create signed download/fetch URL |
| `POST` | `/api/v1/bundles/{bundle_id}/save` | Save guest bundle to a free account |
| `GET` | `/api/v1/bundles/quota/guest` | Read guest quota |
| `POST` | `/api/v1/bundles/cleanup/expired` | Cleanup expired guest bundles |

### Generate Matrix Bundle

```bash
curl -s http://localhost:8000/api/v1/bundles \
  -H 'content-type: application/json' \
  -d '{
    "idea_request": {
      "idea": "Build an AI app that analyzes GitHub repositories",
      "build_type": "agent",
      "goal": "portfolio",
      "preferred_coder": "gitpilot"
    },
    "preferred_coder": "gitpilot"
  }'
```

## Prompt endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/bundles/{bundle_id}/prompt/{coder}` | Read one coder prompt |

Supported coders:

```text
claude-code
codex-chatgpt
cursor
gitpilot
ibm-bob
generic-ai-coder
```

## Validation endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/bundles/{bundle_id}/validate` | Validate current bundle result |
| `POST` | `/api/v1/validation/patch` | Validate a patch/diff |
| `POST` | `/api/v1/validation/repository` | Validate a generated repository upload |

Validation returns:

```text
approved
needs-repair
rejected
```

## MatrixHub endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/publications/matrixhub/{bundle_id}` | Dry-run or publish to MatrixHub |
| `POST` | `/api/v1/bundles/{bundle_id}/publish-to-matrixhub` | Bundle-level publish action |

MatrixHub should reject bundles missing control files, standards lock, validation report, manifest, checksums, or trust metadata.

## Security and observability endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/api/v1/metrics` | Versioned metrics |
| `GET` | `/api/v1/auth/status` | Auth/session status |
| `POST` | `/api/v1/auth/session` | Create session placeholder |
| `POST` | `/api/v1/auth/session/verify` | Verify session placeholder |
| `GET` | `/api/v1/audit/recent` | Recent audit events |

## Contracts

The API is contract-first. Shared schemas live in:

```text
packages/contracts/schemas/
packages/contracts/examples/
packages/contracts/openapi.json
```

Validate contracts:

```bash
python scripts/validate_contracts.py
make openapi
```
