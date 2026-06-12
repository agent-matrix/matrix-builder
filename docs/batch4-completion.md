# Batch 4 — Backend API and agent-generator adapter

Batch 4 connects Matrix Builder to the engine boundary without duplicating engine logic.

## Purpose

Matrix Builder is the public product and orchestration layer. It receives ideas, asks for blueprint candidates, asks for controlled blueprints, asks for Matrix Bundles, and exposes prompts/validation to the UI.

The generation work remains behind `agent_generator_adapter.py`. The standards/rules source remains behind `matrix_definitions_client.py`.

## Rule

```text
matrix-builder does orchestration.
agent-generator does generation.
matrix-definitions provides rules.
```

## Delivered

- FastAPI service endpoints
- health and readiness endpoints
- ideas endpoint
- blueprint candidates endpoint
- selected blueprint generation endpoint
- Matrix Bundle generation endpoint
- bundle prompt endpoint
- standards endpoint
- bundle validation endpoint
- `agent_generator_adapter.py`
- `matrix_definitions_client.py`
- `MatrixBuilderService` orchestration layer
- basic database record models
- API tests and adapter tests

## Exit criteria

A developer can run:

```bash
make test
make lint
make openapi
```

The backend can call `agent-generator` through a clean adapter boundary. In Batch 4 the adapter uses deterministic mock mode so the repository remains runnable without external services.
