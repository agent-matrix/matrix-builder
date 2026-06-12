import json
from pathlib import Path

def load_taxonomy() -> dict:
    return json.loads(Path("app/data/topic_taxonomy.json").read_text(encoding="utf-8"))
