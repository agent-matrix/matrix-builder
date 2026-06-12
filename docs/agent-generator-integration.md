# agent-generator Integration

`agent-generator` is the internal engine. Matrix Builder is the public product and orchestration layer.

## Boundary rule

```text
matrix-builder does orchestration.
agent-generator does generation.
```

Matrix Builder should call `agent-generator` through:

```text
services/api/app/integrations/agent_generator_adapter.py
```

## Adapter responsibilities

The adapter exposes stable methods for:

- parsing ideas
- generating blueprint candidates
- generating selected controlled blueprints
- generating Matrix Bundle files
- generating AI-coder prompt packs
- validating patches/repositories
- producing repair prompts
- exporting ZIP metadata

## Matrix Builder responsibilities

Matrix Builder owns:

- user session and quota
- API request/response contracts
- bundle persistence and expiration
- signed download URLs
- copy prompt UI
- validation report display
- MatrixHub publication request

## Modes

Local deterministic mode:

```text
AGENT_GENERATOR_MODE=mock
```

Future SDK mode:

```text
AGENT_GENERATOR_MODE=sdk
```

Future remote mode:

```text
AGENT_GENERATOR_MODE=http
AGENT_GENERATOR_API_URL=https://engine.ruslanmv.com
```

## Contract compatibility

The adapter must use the shared schemas in:

```text
packages/contracts/schemas/
services/api/app/schemas/
apps/web/src/types/contracts.ts
```

Do not let the engine return untyped or ad-hoc data into the product layer.
