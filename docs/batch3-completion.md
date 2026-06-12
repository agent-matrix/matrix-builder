# Batch 3 — Contracts, schemas, and shared types

Batch 3 makes Matrix Builder machine-readable before the backend becomes complex.

## Completed deliverables

- Strict JSON Schemas for idea requests, blueprint candidates, blueprint results, Matrix Bundles, prompt packs, validation reports, and MatrixHub publication payloads.
- Example payloads for every contract.
- Python Pydantic models mirroring the contracts.
- TypeScript contract types for the web app and future SDK.
- OpenAPI draft generation through `make openapi`.
- Contract tests that validate examples with JSON Schema and Pydantic.
- `scripts/validate_contracts.py` wired into `make lint`.

## Contract rule

The public UX may stay simple, but every payload crossing the boundary between Matrix Builder, `agent-generator`, `matrix-definitions`, and MatrixHub must be typed and validated.

## Exit criteria

Frontend, backend, and `agent-generator` now have a shared shape for the data they exchange.
