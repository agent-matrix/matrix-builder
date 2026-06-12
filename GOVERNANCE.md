# Governance

Matrix Builder is part of the Ruslan Magana controlled-generation ecosystem.

## Ownership model

| Area | Owner |
|---|---|
| Product direction | Ruslan Magana |
| Public UX | Matrix Builder maintainers |
| Generation engine integration | agent-generator maintainers |
| Standards policy | matrix-definitions maintainers |
| Registry publication | MatrixHub maintainers |
| Security and release gates | Release owner + security reviewer |

## Change policy

- UX changes should preserve the simple flow: idea → candidates → bundle → prompt/ZIP → validation.
- API changes must update contracts and examples.
- Engine behavior changes must happen in `agent-generator`, not by duplicating logic here.
- Standards changes must happen in `matrix-definitions`.
- Publication rules must remain compatible with MatrixHub.
- Security-sensitive changes require reviewer approval.

## Batch process

This repository is intentionally developed in batches:

1. Foundation and quality gates
2. Scout UI implementation
3. Contracts and schemas
4. Backend API and engine adapter
5. Matrix Bundle service
6. AI-coder prompt system
7. Validation, repair, and MatrixHub publishing
8. Security, observability, and deployment
9. Docs, examples, and launch promotion
10. Final release candidate
