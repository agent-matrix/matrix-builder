from __future__ import annotations
from collections import Counter
from threading import Lock

def metric_name(name: str) -> str: return f'matrix_builder_{name}'
class MetricsRegistry:
    def __init__(self) -> None: self._lock=Lock(); self._counters: Counter[str]=Counter()
    def inc(self, name: str, amount: int=1) -> None:
        with self._lock: self._counters[metric_name(name)] += amount
    def render_prometheus(self) -> str:
        with self._lock:
            lines=['# HELP matrix_builder_info Matrix Builder service information','# TYPE matrix_builder_info gauge','matrix_builder_info{service="matrix-builder-api"} 1']
            for name,value in sorted(self._counters.items()): lines += [f'# HELP {name} Matrix Builder counter', f'# TYPE {name} counter', f'{name} {value}']
            return '\n'.join(lines)+'\n'
metrics_registry=MetricsRegistry()
