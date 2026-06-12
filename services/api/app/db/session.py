from __future__ import annotations

from dataclasses import dataclass, field
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass
class InMemoryRepository(Generic[T]):
    """Tiny repository used for Batch 4 API tests and local demos."""

    rows: dict[str, T] = field(default_factory=dict)

    def put(self, row_id: str, row: T) -> T:
        self.rows[row_id] = row
        return row

    def get(self, row_id: str) -> T | None:
        return self.rows.get(row_id)

    def list(self) -> list[T]:
        return list(self.rows.values())


def database_status() -> str:
    return "in-memory-repository-batch-4"
