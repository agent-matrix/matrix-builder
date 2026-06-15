# Matrix Builder Documentation

Matrix Builder is the public product and orchestration layer for controlled AI-assisted software creation by Ruslan Magana.

The documentation is organized around the developer journey:

1. Understand the product.
2. Run the repo locally.
3. Understand the architecture.
4. Use the API and contracts.
5. Generate Matrix Bundles.
6. Send controlled prompts to AI coders.
7. Validate generated output.
8. Publish trusted bundles to MatrixHub.
9. Promote Matrix Builder, Ruslan Magana Definitions, agent-generator, GitPilot, and MatrixHub coherently.

## Core docs

| Document | Purpose |
|---|---|
| `developer-quickstart.md` | Clone, install, run, test, and inspect the product |
| `architecture.md` | Product boundaries and runtime architecture |
| `user-experience.md` | Simple end-user flow and mental model |
| `api-reference.md` | Backend API routes and example requests |
| `bundle-service.md` | Matrix Bundle model, ZIPs, signed URLs, expiration, quotas |
| `ai-ownership.md` | Where AI is allowed: deterministic vs internal AI vs external AI coder |
| `ollabridge-internal-ai.md` | Optional Internal AI (OllaBridge) settings, pairing, and display-only assist |
| `ai-coder-contract.md` | The contract that keeps AI coders controlled |
| `ai-coder-prompt-system.md` | Prompt adapters for Claude Code, Codex / ChatGPT, GitPilot, IBM Bob, Cursor, generic |
| `validation-flow.md` | Approved / needs-repair / rejected control loop |
| `matrixhub-integration.md` | Publishing validated bundles to MatrixHub |
| `agent-generator-integration.md` | Engine adapter boundary |
| `matrix-definitions-integration.md` | Signed standards source boundary |
| `gitpilot-integration.md` | GitPilot by RuslanMV integration path |
| `security-observability-deployment.md` | Production hardening batch |
| `marketing-copy.md` | Public product copy for ruslanmv.com and matrixhub.io |
| `ruslan-magana-definitions-page.md` | Public content for Ruslan Magana Definitions |
| `seo-metadata.md` | SEO metadata and route strategy |
| `example-catalog.md` | Example blueprints, prompts, reports, and screenshots |

## Product sentence

> Matrix Builder gives AI coders a contract, not a prompt.

## Control rule

> AI coders are workers, not architects.
