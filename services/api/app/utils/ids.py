from __future__ import annotations

import hashlib
import re
import uuid


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def stable_id(prefix: str, seed: str, length: int = 14) -> str:
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:length]
    safe_prefix = re.sub(r"[^a-zA-Z0-9_-]", "_", prefix).strip("_") or "id"
    return f"{safe_prefix}_{digest}"
