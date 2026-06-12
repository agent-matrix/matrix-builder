from __future__ import annotations
from contextlib import contextmanager
from dataclasses import dataclass, field
from time import perf_counter
from typing import Iterator
@dataclass
class SpanRecord: name: str; duration_ms: float; attributes: dict[str, object]=field(default_factory=dict)
spans: list[SpanRecord]=[]
def telemetry_enabled() -> bool: return False
@contextmanager
def trace_span(name: str, **attributes: object) -> Iterator[None]:
    started=perf_counter()
    try: yield
    finally: spans.append(SpanRecord(name=name, duration_ms=(perf_counter()-started)*1000, attributes=attributes))
