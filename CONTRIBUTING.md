# Contributing

Thank you for contributing to Matrix Builder.

## Development setup

```bash
cp .env.example .env
make doctor
make test
make lint
```

To start the development stack:

```bash
make dev
```

## Branch workflow

1. Create a feature branch.
2. Keep changes small and reviewable.
3. Run `make test` and `make lint` before opening a pull request.
4. Include documentation changes for behavior changes.
5. Do not change Matrix control concepts without updating docs.

## Quality expectations

Every pull request should preserve these principles:

- Simple user experience.
- Controlled AI-coder execution.
- Clear contracts between frontend, backend, `agent-generator`, `matrix-definitions`, and MatrixHub.
- No generation logic duplicated inside Matrix Builder.
- No secrets committed.
- Tests for new backend behavior.
- Contract examples for new API shapes.

## Commit style

Use concise prefixes:

```text
feat: add bundle download endpoint
fix: repair quota check
chore: update docker compose
security: harden signed URL validation
docs: document GitPilot flow
```
