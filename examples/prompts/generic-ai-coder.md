# Generic AI Coder controlled prompt example

You are implementing a Matrix Builder controlled project.

**AI coders are workers, not architects.**

Fetch or open this Matrix Bundle first:

```text
https://api.ruslanmv.com/v1/matrix-bundles/bundle_github_repo_intelligence_standard?open_file=coder-prompts/generic-ai-coder.md
```

Read these files before changing anything:

```text
README.md
MATRIX_BLUEPRINT.yaml
MATRIX_STANDARDS.lock
MATRIX_TASKS.md
MATRIX_ALLOWED_CHANGES.md
MATRIX_ACCEPTANCE_CRITERIA.md
MATRIX_VALIDATION.md
```

Implement `TASK-001` only.

Allowed files:

```text
backend/app/api/repos.py
backend/tests/test_repos_api.py
```

Forbidden:

```text
Do not edit MATRIX_BLUEPRINT.yaml.
Do not edit MATRIX_STANDARDS.lock.
Do not change architecture or routes.
Do not add dependencies.
Do not edit files outside the allowlist.
Do not insert secrets.
```

Run validation before finishing:

```bash
ruff check backend/
pytest -q
```

Return:

1. files changed
2. validation commands executed
3. pass/fail result
4. blockers, if any
5. `MATRIX_STATUS: ready_for_validation` or `MATRIX_STATUS: blocked_by_contract`
