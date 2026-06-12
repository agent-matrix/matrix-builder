# matrix-definitions Integration

`matrix-definitions` is the signed source of truth for standards, Ruslan Magana Definitions, quality profiles, AI-coder control rules, and MatrixHub publication rules.

## Boundary rule

```text
matrix-definitions provides rules.
matrix-builder consumes rules.
agent-generator applies rules.
```

Matrix Builder should not store the canonical rules internally.

## Client boundary

```text
services/api/app/integrations/matrix_definitions_client.py
```

The client should expose:

- current pack metadata
- active quality profiles
- supported rules and versions
- standards-lock verification metadata
- release digest/signature references

## Standards lock

Every Matrix Bundle must include:

```text
MATRIX_STANDARDS.lock
```

The lock prevents silent standards drift. It records the standards pack used during generation and validation.

## Ruslan Magana Definitions

Ruslan Magana Definitions should explain the product's core principles:

- blueprint contract is mandatory
- standards lock is mandatory
- AI coders edit only allowed files
- AI coders are workers, not architects
- validation and repair loops are mandatory
- MatrixHub publishes only validated, controlled bundles

## Public docs

The public human-readable version should live at:

```text
https://ruslanmv.com/definitions
https://ruslanmv.com/definitions/current
```

The machine-readable current manifest can later live at:

```text
https://ruslanmv.com/definitions/current.json
```
