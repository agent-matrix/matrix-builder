from __future__ import annotations

import re
from pathlib import Path

SECRET_PATTERNS = [
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"(?i)(api[_-]?key|secret|token)\s*=\s*['\"][^'\"]{20,}['\"]"),
]
SKIP_DIRS = {".git", "node_modules", ".venv", "venv", ".pytest_cache", ".mypy_cache"}
violations: list[str] = []
for path in Path(".").rglob("*"):
    if any(part in SKIP_DIRS for part in path.parts) or not path.is_file():
        continue
    if path.suffix.lower() in {".png", ".jpg", ".jpeg", ".gif", ".ico", ".zip"}:
        continue
    text = path.read_text(encoding="utf-8", errors="ignore")
    for pattern in SECRET_PATTERNS:
        if pattern.search(text):
            violations.append(str(path))
            break
if violations:
    raise SystemExit("Potential secrets found:\n" + "\n".join(violations))
print("No obvious committed secrets detected.")
