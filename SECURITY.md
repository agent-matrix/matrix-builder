# Security Policy

Matrix Builder is a control plane for generated software bundles. The project must treat artifact generation, prompt generation, and bundle download as security-sensitive operations.

## Supported versions

| Version | Status |
|---|---|
| `main` | Development |
| `0.1.x` | Batch foundation |

## Reporting vulnerabilities

Please report suspected vulnerabilities privately to the repository owner before public disclosure.

Include:

- Affected component
- Reproduction steps
- Impact
- Suggested fix, if known

## Security principles

- AI coders are workers, not architects.
- Matrix control files are immutable after approval.
- Guest bundles expire.
- No secrets should be generated into bundles.
- Generated artifacts require manifests, checksums, and validation reports.
- Production releases must include SBOMs and provenance metadata.
- CI should use least-privilege permissions.
- Workflow and release changes require owner review.

## Batch 1 security baseline

This batch includes security policy, CODEOWNERS, least-privilege CI workflow defaults, environment examples without real secrets, Docker development isolation, and repository checks. Later batches will add artifact signing, validation gates, audit logs, rate limits, and MatrixHub publication checks.
