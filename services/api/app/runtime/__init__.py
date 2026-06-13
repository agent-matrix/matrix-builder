"""Runtime services: the in-process event bus and the validation run worker (Batch C3)."""

from __future__ import annotations

from app.integrations.object_storage import ObjectStorage
from app.runtime.event_bus import EventBus
from app.runtime.run_worker import RunJob, RunWorker

_bus = EventBus()
_worker: RunWorker | None = None


def get_event_bus() -> EventBus:
    return _bus


def get_run_worker() -> RunWorker:
    global _worker
    if _worker is None:
        # Imported lazily to avoid a circular import at module load.
        from app.dependencies import get_agent_generator_adapter

        _worker = RunWorker(
            bus=_bus, adapter=get_agent_generator_adapter(), storage=ObjectStorage()
        )
    return _worker


__all__ = ["get_event_bus", "get_run_worker", "RunJob", "RunWorker", "EventBus"]
