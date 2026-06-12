from __future__ import annotations

from pathlib import Path

EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".yml", ".yaml", ".toml", ".css"}
SKIP = {"node_modules", ".git", ".venv", "venv"}
changed = 0
for path in Path(".").rglob("*"):
    if any(part in SKIP for part in path.parts) or not path.is_file() or path.suffix not in EXTENSIONS:
        continue
    text = path.read_text(encoding="utf-8", errors="ignore")
    new = "\n".join(line.rstrip() for line in text.splitlines()) + "\n"
    if new != text:
        path.write_text(new, encoding="utf-8")
        changed += 1
print(f"Formatted {changed} files.")
