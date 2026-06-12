#!/usr/bin/env python
import json
from pathlib import Path

data = json.loads(Path("datasets/latest.json").read_text(encoding="utf-8"))
assert "topics" in data and isinstance(data["topics"], list)
for topic in data["topics"]:
    assert "id" in topic and "name" in topic and "signals" in topic
print("Dataset is valid")
