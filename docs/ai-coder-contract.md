# AI Coder Contract

Matrix Builder exists because AI coders are powerful, but they can go out of control.

The product rule is simple:

```text
AI coders are workers, not architects.
```

## What the AI coder may do

The AI coder may:

- Implement the active task.
- Edit only the allowed files.
- Run the validation commands.
- Report blockers when the contract prevents a requested change.
- Produce a summary of changed files and test results.

## What the AI coder must not do

The AI coder must not:

- Change `MATRIX_BLUEPRINT.yaml`.
- Change `MATRIX_STANDARDS.lock`.
- Change architecture, stack, routes, services, or dependencies without approval.
- Edit files outside the task allowlist.
- Add secrets to prompts, `.env.example`, or source files.
- Refactor unrelated code.
- Ignore validation failures.

## Control files

| File | Purpose |
|---|---|
| `MATRIX_BLUEPRINT.yaml` | The selected architecture and product contract |
| `MATRIX_STANDARDS.lock` | The locked standards pack and rule digests |
| `MATRIX_TASKS.md` | Sequenced implementation tasks |
| `MATRIX_ALLOWED_CHANGES.md` | File-level edit policy |
| `MATRIX_ACCEPTANCE_CRITERIA.md` | Definition of done |
| `MATRIX_VALIDATION.md` | Commands and checks required before completion |

## Example AI-coder instruction

```text
You are implementing a Matrix Builder controlled blueprint.
You are not the architect. You are the implementation worker.

Read the Matrix Bundle first.
Implement TASK-001 only.
Edit only the allowed files.
Do not change architecture.
Do not add dependencies.
Do not modify Matrix control files.
Run validation before finishing.
```

## Validation loop

```text
AI coder output
  ↓
Matrix Builder validation
  ↓
approved / needs-repair / rejected
  ↓
repair prompt if needed
```

This loop is the difference between Matrix Builder and normal prompt tools.
