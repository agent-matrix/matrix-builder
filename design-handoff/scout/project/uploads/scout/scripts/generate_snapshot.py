#!/usr/bin/env python
from pathlib import Path
from datetime import datetime, timezone
import json, shutil

root = Path(__file__).resolve().parents[1]
sample = json.loads((root / "app/data/sample_trends.json").read_text(encoding="utf-8"))
sample["generated_at"] = datetime.now(timezone.utc).isoformat()
(root / "datasets").mkdir(exist_ok=True)
(root / "datasets/latest.json").write_text(json.dumps(sample, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
snapshot = root / "datasets/snapshots" / (datetime.now(timezone.utc).date().isoformat() + ".json")
snapshot.parent.mkdir(parents=True, exist_ok=True)
snapshot.write_text(json.dumps(sample, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Wrote {snapshot}")
