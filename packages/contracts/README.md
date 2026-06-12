# Matrix Builder Contracts

This package is the machine-readable contract layer shared by:

- `apps/web` — Matrix Builder user interface
- `services/api` — FastAPI orchestration service
- `agent-generator` — internal generation engine adapter
- `matrix-definitions` — signed standards pack source
- `matrixhub.io` — registry and publication destination

Batch 3 makes these contracts strict enough to prevent uncontrolled growth.
Frontend, backend, and future `agent-generator` integration must agree on these files before adding new behavior.

## Schemas

```text
schemas/idea-request.schema.json
schemas/blueprint-candidate.schema.json
schemas/blueprint-result.schema.json
schemas/matrix-bundle.schema.json
schemas/prompt-pack.schema.json
schemas/validation-report.schema.json
schemas/publication.schema.json
```

## Examples

```text
examples/idea-request.json
examples/blueprint-candidate.json
examples/blueprint-result.json
examples/matrix-bundle.json
examples/prompt-pack.json
examples/validation-report.json
examples/publication.json
```

## Validation

```bash
python scripts/validate_contracts.py
make openapi
make test
```

The contracts use JSON Schema Draft 2020-12. Python models live in `services/api/app/schemas/` and TypeScript types live in `apps/web/src/types/contracts.ts` and `packages/client-sdk/src/types.ts`.
