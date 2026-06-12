# Validation flow

Matrix Builder closes the control loop after an AI coder edits a Matrix Bundle.

```text
Matrix Bundle → AI coder patch/repo → validation → approved / needs-repair / rejected
```

## Statuses

- `approved`: the output stayed inside the Matrix contract and can proceed to MatrixHub dry-run.
- `needs-repair`: non-critical drift exists, usually dependency drift or missing trust artifacts.
- `rejected`: critical drift was detected, such as modifying `MATRIX_BLUEPRINT.yaml` or `MATRIX_STANDARDS.lock`.

## Request shape

Submit a patch or repository reference to:

```text
POST /api/v1/bundles/{bundle_id}/validate
POST /api/v1/validation/patch
POST /api/v1/validation/repository
```

The request tracks changed files, dependency changes, optional artifact references, and optional digest evidence.

## Control rule

AI coders are workers, not architects. They may implement allowed tasks, but they must not change Matrix control files, selected architecture, standards locks, or unapproved dependencies.
