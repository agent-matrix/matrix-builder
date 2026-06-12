from __future__ import annotations

from pathlib import Path

paths = [Path("services/api"), Path("workers"), Path("scripts"), Path("tests")]
violations: list[str] = []
for root in paths:
    for path in root.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        if "\t" in text:
            violations.append(f"{path}: contains tab")
        for i, line in enumerate(text.splitlines(), start=1):
            if line.rstrip() != line:
                violations.append(f"{path}:{i}: trailing whitespace")
if violations:
    raise SystemExit("Python style violations:\n" + "\n".join(violations[:50]))
print("Python style checks passed.")
