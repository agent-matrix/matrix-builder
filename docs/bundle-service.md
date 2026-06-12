# Matrix Bundle Service

A Matrix Bundle is the downloadable, fetchable, controlled build package created by Matrix Builder.

It is the product's core artifact.

## User mental model

```text
I describe my idea.
Matrix Builder gives me a controlled bundle.
I send that bundle to my AI coder.
The AI coder follows the contract.
```

## Bundle contents

```text
README.md
MATRIX_BLUEPRINT.yaml
MATRIX_STANDARDS.lock
MATRIX_TASKS.md
MATRIX_ALLOWED_CHANGES.md
MATRIX_ACCEPTANCE_CRITERIA.md
MATRIX_VALIDATION.md
docs/architecture.md
docs/security.md
docs/standards-report.md
coder-prompts/claude-code.md
coder-prompts/codex-chatgpt.md
coder-prompts/cursor.md
coder-prompts/gitpilot.md
coder-prompts/ibm-bob.md
coder-prompts/generic-ai-coder.md
coder-prompts/prompt-pack.json
artifacts/manifest.json
artifacts/checksums.txt
```

## Bundle lifecycle

```text
draft → ready → downloaded / fetched → validated → saved or expired → optionally published
```

Guest bundles should expire safely. Saved bundles require a free account.

## Guest mode

Suggested default:

```text
3 bundles per day
48 hour expiration
ZIP download allowed
copy prompt allowed
no long-term history
```

## Free account mode

Suggested default:

```text
20 bundles per month
saved private bundles
validation history
MatrixHub dry-run publishing
longer signed URL windows
```

## Signed bundle URL pattern

```text
https://api.ruslanmv.com/v1/matrix-bundles/{bundle_id}?token={signed_token}
```

Open a specific prompt file:

```text
https://api.ruslanmv.com/v1/matrix-bundles/{bundle_id}?open_file=coder-prompts/gitpilot.md
```

## Anthropic Designer-style behavior, Matrix Builder version

The user should see:

```text
Your Matrix Bundle is ready.

[Copy prompt]
[Download ZIP]
[Send to GitPilot]
[Send to Claude Code]
[Send to Codex / ChatGPT]
[Validate result]
[Publish to MatrixHub]
```

The AI coder should receive:

```text
Fetch this Matrix Bundle, read the README and Matrix control files, then implement the current task only.
```

Never send only a vague idea to the AI coder. Send the bundle and the contract.
