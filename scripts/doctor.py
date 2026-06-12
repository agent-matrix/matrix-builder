from __future__ import annotations

import shutil
from pathlib import Path

required = [
    "README.md",
    "Makefile",
    "package.json",
    "pyproject.toml",
    "docker-compose.dev.yml",
    "services/api/app/main.py",
    "apps/web/src/app/matrix-builder/page.tsx",
]
missing = [path for path in required if not Path(path).exists()]
if missing:
    raise SystemExit(f"Missing required files: {missing}")

for tool in ["python", "node"]:
    location = shutil.which(tool)
    if not location:
        raise SystemExit(f"Required tool not found: {tool}")
    print(f"{tool}: {location}")

if shutil.which("docker"):
    print("docker: available")
else:
    print("docker: not found; make dev requires Docker, but make test/make lint can still run")

print("Matrix Builder foundation looks ready.")
