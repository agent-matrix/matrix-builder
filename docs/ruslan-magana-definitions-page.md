# Ruslan Magana Definitions — Public Page Content

This page is intended for `ruslanmv.com/definitions`.

## Hero

```text
Ruslan Magana Definitions
A public control standard for AI-assisted software generation.
```

## Intro

Ruslan Magana Definitions define how Matrix Builder, agent-generator, matrix-definitions, GitPilot, and MatrixHub keep AI-assisted generation controlled.

The standard is simple:

```text
AI coders are workers, not architects.
```

## Why it exists

AI coders can write code quickly, but without a contract they may:

- change architecture unexpectedly
- add dependencies without approval
- edit files outside the task
- ignore security standards
- skip validation
- produce code that cannot be trusted or published

Ruslan Magana Definitions convert those risks into enforceable product rules.

## Core principles

| Principle | Meaning |
|---|---|
| Blueprint first | Every generated project has `MATRIX_BLUEPRINT.yaml` |
| Standards locked | Every bundle has `MATRIX_STANDARDS.lock` |
| AI coder bounded | AI coders edit only allowed files |
| Task scoped | Prompts must target one task at a time |
| Validation required | Output must be approved, needs-repair, or rejected |
| Repair loop | Failures produce a bounded repair prompt |
| Publish only trusted | MatrixHub accepts only validated, controlled bundles |

## Ecosystem

```text
Matrix Builder       → public product
agent-generator      → engine
matrix-definitions   → signed rules
GitPilot             → controlled AI coder path
MatrixHub            → registry
ruslanmv.com         → public documentation and authority platform
```

## Public message

```text
Matrix Builder gives AI coders a contract, not a prompt.
```

## Machine-readable definitions

Future route:

```text
/definitions/current.json
```

This route should expose the current signed definition manifest consumed by Matrix Builder and agent-generator.
