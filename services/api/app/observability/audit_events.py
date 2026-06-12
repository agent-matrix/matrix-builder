from __future__ import annotations
import json
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4
@dataclass(frozen=True)
class AuditEvent:
    event_id: str; event_type: str; actor_id: str; resource_type: str; resource_id: str | None; outcome: str; created_at: str; payload: dict[str, Any]=field(default_factory=dict)
def build_audit_event(event_type: str, *, actor_id: str='guest', resource_type: str='system', resource_id: str | None=None, outcome: str='success', payload: dict[str, Any] | None=None) -> AuditEvent:
    return AuditEvent(f'aud_{uuid4().hex[:18]}', event_type, actor_id, resource_type, resource_id, outcome, datetime.now(UTC).isoformat(), payload or {})
def audit_event(event_type: str, payload: dict[str, object] | None=None) -> dict[str, object]: return asdict(build_audit_event(event_type, payload=payload or {}))
def write_audit_event(path: str, event: AuditEvent) -> None:
    target=Path(path); target.parent.mkdir(parents=True, exist_ok=True)
    with target.open('a', encoding='utf-8') as handle: handle.write(json.dumps(asdict(event), sort_keys=True)+'\n')
