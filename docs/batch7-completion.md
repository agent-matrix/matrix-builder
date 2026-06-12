# Batch 7 completion — Validation, repair, and MatrixHub publishing

## Added

- Validation request contract.
- Drift detection adapter.
- Forbidden file change detection.
- Dependency drift detection.
- Standards lock verification boundary.
- Bounded repair prompt generation.
- Validation report page.
- MatrixHub dry-run publishing endpoint.
- Bundle publish-to-MatrixHub endpoint.

## Exit criteria

Matrix Builder can now say:

```text
Approved
Needs repair
Rejected
```

This is the key difference between Matrix Builder and normal prompt tools.
