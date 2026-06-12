from __future__ import annotations

from pathlib import Path

REQUIRED_FILES = [
    "README.md",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "GOVERNANCE.md",
    "CODEOWNERS",
    ".env.example",
    "Makefile",
    "package.json",
    "pyproject.toml",
    "docker-compose.dev.yml",
    ".github/workflows/ci.yml",
    "services/api/app/main.py",
    "apps/web/src/app/matrix-builder/page.tsx",
    "packages/contracts/README.md",
]

missing = [path for path in REQUIRED_FILES if not Path(path).exists()]
if missing:
    raise SystemExit("Missing required files:\n" + "\n".join(missing))

print(f"Repository structure OK ({len(REQUIRED_FILES)} required files).")
