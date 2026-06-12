from __future__ import annotations
from dataclasses import asdict
from app.core.config import get_settings
from app.observability.audit_events import AuditEvent, build_audit_event, write_audit_event
class AuditService:
    def __init__(self) -> None: self.settings=get_settings(); self._events: list[AuditEvent]=[]
    def record(self, event_type: str, *, actor_id: str='guest', resource_type: str='system', resource_id: str | None=None, outcome: str='success', payload: dict[str, object] | None=None) -> AuditEvent:
        event=build_audit_event(event_type, actor_id=actor_id, resource_type=resource_type, resource_id=resource_id, outcome=outcome, payload=payload); self._events.append(event); write_audit_event(self.settings.audit_log_path, event); return event
    def recent(self, limit: int=50) -> list[dict[str, object]]: return [asdict(event) for event in self._events[-limit:]]
audit_service=AuditService()
