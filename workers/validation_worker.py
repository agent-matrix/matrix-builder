"""Validation worker entry point (Batch C3).

The validation pipeline is now real: enqueue -> engine validate -> persist findings -> write
artifacts (report.json, diff.patch, log.txt) -> create a matrix_commit on approval or attach a
repair suggestion on needs-repair, emitting append-only run events for live streaming.

In the running API this executes in-process via ``app.runtime.run_worker.RunWorker`` (started on
app startup and fed by ``POST /api/v1/batches/{id}/runs``). This module exposes ``process_run``
so the same pipeline can also be driven from an out-of-process job runner against one ``RunJob``.
"""

from __future__ import annotations

from typing import Any


def process_run(job: Any) -> None:
    """Run the real validation pipeline for a single job (synchronous, no event loop required)."""
    from app.dependencies import get_agent_generator_adapter
    from app.integrations.object_storage import ObjectStorage
    from app.runtime import get_event_bus
    from app.runtime.run_worker import RunWorker

    worker = RunWorker(
        bus=get_event_bus(), adapter=get_agent_generator_adapter(), storage=ObjectStorage()
    )
    worker._process(job)  # noqa: SLF001 - intentional reuse of the pipeline in single-job mode


def run() -> str:
    return "validation_worker:ready"
