# GitPilot Integration

GitPilot by RuslanMV is a first-class AI-coder path for Matrix Builder.

The purpose is not to give GitPilot an unconstrained product idea. The purpose is to give GitPilot a **Matrix Bundle** and ask it to implement within the contract.

## User experience

On the Matrix Bundle result screen:

```text
[Send to GitPilot]
[Copy GitPilot prompt]
[Download ZIP]
```

The user should feel:

```text
Matrix Builder prepared the project contract.
GitPilot can now help implement it safely.
```

## GitPilot prompt behavior

GitPilot should be instructed to:

1. Fetch or read the Matrix Bundle.
2. Read `README.md` and all Matrix control files.
3. Use a planning step before implementation.
4. Implement only the active task.
5. Edit only allowed files.
6. Stop if a dependency, architecture, or forbidden-file change is required.
7. Run validation.
8. Produce a reviewer-style summary.

## Example opening

```text
You are GitPilot working inside a Matrix Builder controlled project.
AI coders are workers, not architects.

Fetch this Matrix Bundle and read its README and Matrix control files first:
{bundle_url}

Implement TASK-001 only.
```

## MatrixHub publishing

A GitPilot-created result should not be published directly. It must pass Matrix Builder validation first:

```text
GitPilot implementation → Matrix Builder validation → approved → MatrixHub publish
```
