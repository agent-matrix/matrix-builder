# AI-Coder Prompt System

Matrix Builder emits coder-specific prompts from the same Matrix Bundle contract.

Supported coders:

```text
Claude Code
Codex / ChatGPT
GitPilot by RuslanMV
IBM Bob
Cursor
Generic AI coder
```

## Prompt structure

Every prompt contains:

1. Matrix Bundle fetch URL
2. Contract files to read first
3. Active task
4. Allowed files
5. Forbidden changes
6. Validation commands
7. Required response format
8. `MATRIX_STATUS` ending

## Required message

Every prompt repeats:

```text
AI coders are workers, not architects.
```

## Coder differences

| Coder | Prompt emphasis |
|---|---|
| Claude Code | Read files first, preserve contract, run checks, summarize changes |
| Codex / ChatGPT | Produce bounded implementation, avoid speculative refactors, return diff/results |
| GitPilot | Explorer/Planner/Coder/Reviewer-style flow with approval-aware execution |
| IBM Bob | Enterprise-safe implementation with explicit governance and audit summary |
| Cursor | Workspace-level file allowlist and focused edits |
| Generic AI coder | Lowest-common-denominator instructions for any AI coding tool |

## Fetch URL pattern

```text
Fetch this Matrix Bundle:
https://api.ruslanmv.com/v1/matrix-bundles/{bundle_id}
```

Open a prompt directly:

```text
https://api.ruslanmv.com/v1/matrix-bundles/{bundle_id}?open_file=coder-prompts/claude-code.md
```

## Why not one generic prompt?

Each AI coder has different workflows and strengths. But none of them should become the architect. The Matrix Bundle is the source of truth.
