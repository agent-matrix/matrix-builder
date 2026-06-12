#!/usr/bin/env python
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
out = root / "site" / "_site" / "scout"
out.mkdir(parents=True, exist_ok=True)
for path in (root / "dashboard").glob("**/*"):
    if path.is_file():
        dest = out / path.relative_to(root / "dashboard")
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
print(f"Built static dashboard at {out}")
