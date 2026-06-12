from __future__ import annotations

from pathlib import Path


def ensure_local_storage(path: str) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


class LocalObjectStorage:
    """Small filesystem-backed object storage adapter used in dev/test.

    The interface mirrors object storage operations enough that S3/MinIO can be wired later
    without changing the Matrix Bundle service.
    """

    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def put_bytes(self, key: str, data: bytes) -> str:
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f"local://{key}"

    def put_text(self, key: str, data: str) -> str:
        return self.put_bytes(key, data.encode("utf-8"))

    def path_for(self, key: str) -> Path:
        return self.root / key

    def exists(self, key: str) -> bool:
        return self.path_for(key).exists()

    def delete_prefix(self, prefix: str) -> int:
        base = self.root / prefix
        if not base.exists():
            return 0
        count = 0
        for path in sorted(base.rglob("*"), reverse=True):
            if path.is_file():
                path.unlink()
                count += 1
            elif path.is_dir():
                path.rmdir()
        if base.exists():
            base.rmdir()
        return count
