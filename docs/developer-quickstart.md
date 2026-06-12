# Developer Quickstart

This guide gets a developer from clone to a working local Matrix Builder environment.

## 1. Install prerequisites

- Python 3.11+
- Node.js 20+
- Docker Desktop or compatible Docker engine
- Optional: pnpm 9+

## 2. Configure environment

```bash
cp .env.example .env
make doctor
```

`make doctor` checks the required project files and local tooling. Docker may be unavailable in restricted environments; the command reports that as a warning.

## 3. Run quality gates

```bash
make test
make lint
make openapi
```

Expected result:

```text
make test   → backend, worker, canary, and contract tests pass
make lint   → repository structure, secret scan, Python style, contracts, frontend placeholder checks pass
make openapi → packages/contracts/openapi.json is regenerated
```

## 4. Start development stack

```bash
make dev
```

This starts the Docker Compose stack for:

- Matrix Builder API
- Matrix Builder web app
- Worker process
- Postgres
- Redis
- Local object storage

For a local backend-only run:

```bash
make api-dev
```

Then open:

```text
http://localhost:8000/health
http://localhost:8000/api/v1/ready
```

## 5. Open the product page

The first product page is:

```text
/apps/web/src/app/matrix-builder/page.tsx
```

It implements the Scout-inspired flow:

```text
idea input → scanning → candidates → Matrix Bundle → copy prompt / download ZIP / validate
```

## 6. Generate a Matrix Bundle through the API

```bash
curl -s http://localhost:8000/api/v1/bundles \
  -H 'content-type: application/json' \
  -d '{
    "idea_request": {
      "idea": "Build an AI agent that analyzes GitHub repositories and creates improvement reports",
      "build_type": "agent",
      "goal": "portfolio",
      "preferred_coder": "gitpilot"
    },
    "preferred_coder": "gitpilot"
  }'
```

## 7. Read a controlled prompt

```bash
curl -s http://localhost:8000/api/v1/bundles/{bundle_id}/prompt/gitpilot
```

Every prompt says the same control message:

```text
AI coders are workers, not architects.
```

## 8. Validate a result

```bash
curl -s http://localhost:8000/api/v1/bundles/{bundle_id}/validate -X POST
```

Matrix Builder returns one of:

```text
approved
needs-repair
rejected
```

## 9. Publish dry-run to MatrixHub

```bash
curl -s http://localhost:8000/api/v1/publications/matrixhub/{bundle_id} -X POST
```

MatrixHub publishing remains a trust gate. It should accept only validated, controlled bundles.

## 10. Recommended development order

```text
UI change → contract update → backend schema update → tests → docs → examples
```

Do not bypass contracts. They prevent uncontrolled growth.
