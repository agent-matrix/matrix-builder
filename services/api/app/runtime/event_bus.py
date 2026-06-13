"""In-process pub/sub for run events (Batch C3).

The worker publishes run events without ever awaiting a subscriber, so a slow or stalled
WebSocket client can never apply backpressure to the engine ("drop and replay"). If a
subscriber's bounded queue fills up, it receives a single overflow sentinel and is expected to
close and reconnect, replaying any missed events from the append-only ``run_events`` table by
``seq``. Durability lives in Postgres; this bus only carries the live tail.
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from typing import Any

OVERFLOW: dict[str, Any] = {"__overflow__": True}


class EventBus:
    def __init__(self, max_queue: int = 512) -> None:
        self._subs: dict[str, set[asyncio.Queue]] = defaultdict(set)
        self._max_queue = max_queue

    def subscribe(self, run_id: str) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=self._max_queue)
        self._subs[run_id].add(queue)
        return queue

    def unsubscribe(self, run_id: str, queue: asyncio.Queue) -> None:
        subs = self._subs.get(run_id)
        if subs is not None:
            subs.discard(queue)
            if not subs:
                self._subs.pop(run_id, None)

    def publish_nowait(self, run_id: str, event: dict[str, Any]) -> None:
        """Fan out one event to every subscriber. Must run on the event loop thread.

        Never blocks: a full subscriber queue gets an overflow sentinel instead, signalling the
        consumer to drop and replay from the database.
        """
        for queue in list(self._subs.get(run_id, ())):
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                self._overflow(queue)

    @staticmethod
    def _overflow(queue: asyncio.Queue) -> None:
        try:
            queue.put_nowait(OVERFLOW)
        except asyncio.QueueFull:
            pass


__all__ = ["EventBus", "OVERFLOW"]
