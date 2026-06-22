SHELL := /usr/bin/env bash
.DEFAULT_GOAL := help

.PHONY: help doctor dev dev-local api-dev down test lint format clean bootstrap openapi security sbom checksums release-checks install migrate

help:
	@echo "Matrix Builder development commands"
	@echo ""
	@echo "  make install    Install Python + frontend dependencies"
	@echo "  make doctor     Check local tools and repository structure"
	@echo "  make bootstrap  Create local folders and copy .env.example to .env if needed"
	@echo "  make dev        Start Docker Compose development stack"
	@echo "  make api-dev    Run the FastAPI backend locally"
	@echo "  make migrate    Apply database migrations (Aiven: set MIGRATION_DATABASE_URL)"
	@echo "  make test       Run tests"
	@echo "  make lint       Run static checks"
	@echo "  make format     Normalize whitespace"
	@echo "  make down       Stop Docker Compose development stack"
	@echo "  make clean      Remove local caches"

install: bootstrap
	@echo "Installing Python dependencies into .venv (uv if present, else venv + pip)…"
	@if command -v uv >/dev/null 2>&1; then \
	  uv venv --python "$${PYTHON:-python3}" .venv; \
	  UV_LINK_MODE=copy uv pip install --python .venv/bin/python -r requirements.txt; \
	else \
	  echo "uv not found — falling back to venv + pip (see https://docs.astral.sh/uv/ to install uv)"; \
	  "$${PYTHON:-python3}" -m venv .venv; \
	  .venv/bin/python -m pip install -r requirements.txt; \
	fi
	@echo "Installing frontend dependencies (pnpm workspace)…"
	@pnpm install
	@echo "Install complete. Run 'make test' to verify."

bootstrap:
	@mkdir -p .local/bundles .local/postgres .local/minio .local/redis
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env from .env.example"; fi

doctor: bootstrap
	@python scripts/doctor.py

dev: bootstrap
	@docker compose -f docker-compose.dev.yml up --build

dev-local: api-dev

api-dev: bootstrap
	@PYTHONPATH=services/api python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

down:
	@docker compose -f docker-compose.dev.yml down --remove-orphans

migrate:
	@bash scripts/migrate.sh

test:
	@bash scripts/test.sh

lint:
	@bash scripts/lint.sh

format:
	@bash scripts/format.sh

openapi:
	@python scripts/generate_openapi.py

clean:
	@rm -rf .pytest_cache .mypy_cache .ruff_cache htmlcov coverage .coverage
	@find . -type d -name __pycache__ -prune -exec rm -rf {} +
	@echo "Cleaned local caches."

security:
	@python scripts/security_scan.py

sbom:
	@python scripts/generate_sbom.py

checksums:
	@python scripts/generate_checksums.py

release-checks: test lint security sbom checksums
	@echo "Release checks completed."
