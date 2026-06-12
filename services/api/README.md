# Matrix Builder API

FastAPI service for Matrix Builder orchestration.

Batch 1 provides a buildable skeleton and health/status endpoints. Later batches will connect these endpoints to `agent-generator`, `matrix-definitions`, Matrix Bundle storage, validation, and MatrixHub publishing.

## Local run

```bash
PYTHONPATH=services/api python -m uvicorn app.main:app --reload --port 8000
```

## Contract principle

This service orchestrates generation. It must not duplicate the compiler, standards rules, or validation engine. Those belong to `agent-generator` and `matrix-definitions`.
