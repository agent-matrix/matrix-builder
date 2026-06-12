from __future__ import annotations

from app.core.config import get_settings
from app.storage.bundle_paths import storage_root
from app.storage.local_storage import LocalObjectStorage


class ObjectStorage:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._local = LocalObjectStorage(storage_root())

    def backend(self) -> str:
        return self.settings.storage_backend

    def put_bytes(self, key: str, data: bytes) -> str:
        return self._local.put_bytes(key, data)

    def put_text(self, key: str, data: str) -> str:
        return self._local.put_text(key, data)

    def exists(self, key: str) -> bool:
        return self._local.exists(key)

    def local_path(self, key: str):
        return self._local.path_for(key)

    def delete_prefix(self, prefix: str) -> int:
        return self._local.delete_prefix(prefix)
