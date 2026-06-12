#!/usr/bin/env python
from pathlib import Path
import shutil, json

root = Path(__file__).resolve().parents[1]
out = root / "public" / "scout"
if out.exists():
    shutil.rmtree(out)
out.mkdir(parents=True)
shutil.copytree(root / "dashboard", out, dirs_exist_ok=True)
(out / "data").mkdir(exist_ok=True)
shutil.copy2(root / "datasets/latest.json", out / "data/latest.json")
print(f"Exported GitHub Pages bundle to {out}")
