from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "api"))

from app.services.bundle_service import BundleStore


if __name__ == "__main__":
    result = BundleStore().cleanup_expired()
    print(result.model_dump_json(indent=2))
