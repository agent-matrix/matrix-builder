# Changelog

## 0.4.0-batch.4

- Added FastAPI orchestration endpoints for ideas, blueprint candidates, selected blueprint generation, Matrix Bundle generation, bundle prompts, standards status, and bundle validation.
- Added a clean `AgentGeneratorAdapter` boundary with deterministic mock mode and an SDK mode placeholder for the real `agent-generator` engine.
- Added a `MatrixDefinitionsClient` boundary for current standards-pack metadata from `matrix-definitions`.
- Added `MatrixBuilderService` as the orchestration layer enforcing: Matrix Builder orchestrates, agent-generator generates, matrix-definitions provides rules.
- Added `BundleGenerationRequest` and `BlueprintGenerationRequest` Pydantic contracts.
- Expanded basic database record models for users, ideas, candidates, blueprints, bundles, runs, prompts, standards, validation reports, and publications.
- Added API and adapter tests for the Batch 4 backend flow.

## 0.3.0-batch.3

- Added strict Matrix Builder contract schemas.
- Added contract examples for idea, candidates, blueprint, bundle, prompt pack, validation, and publication.
- Added Python Pydantic models aligned with contracts.
- Added TypeScript contract types and SDK exports.
- Added contract validation script and tests.
- Added OpenAPI draft generation from FastAPI models.

## 0.2.0-batch.2

- Implemented Scout Matrix Builder UI with mock data.
- Added hero, idea input, scanning state, candidate cards, bundle result, prompt copy, ZIP UI, and send-to-coder panel.

## 0.1.0-batch.1

- Added repository foundation, tooling, CI, Docker development environment, tests, linting, CODEOWNERS, SECURITY, CONTRIBUTING, and governance documents.

## 0.6.0 - Batch 6

- Added AI-coder prompt system for Claude Code, Codex / ChatGPT, Cursor, GitPilot, IBM Bob, and generic AI coders.
- Added canonical backend prompt policy and prompt pack generation.
- Added prompt contract fields for allowed files, validation commands, hard constraints, and handoff mode.
- Added prompt pack JSON to generated Matrix Bundle ZIPs.
- Added frontend controlled prompt preview, allowed files policy display, and send/fetch bundle URL pattern.
- Added Batch 6 prompt tests.


## 0.7.0-batch.7

### Added
- Validation request contract for repo/patch checks.
- Drift detection adapter for forbidden files, dependency changes, and standards-lock drift.
- Repair prompt generation for failed validations.
- MatrixHub dry-run publication gate.
- Validation report page and UI contracts.

### Product rule
- Matrix Builder can now return `approved`, `needs-repair`, or `rejected`.
