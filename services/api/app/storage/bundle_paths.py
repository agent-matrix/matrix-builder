from __future__ import annotations

from pathlib import Path

from app.core.config import get_settings


def storage_root() -> Path:
    root = Path(get_settings().storage_root)
    root.mkdir(parents=True, exist_ok=True)
    return root


def bundles_root() -> Path:
    path = storage_root() / "bundles"
    path.mkdir(parents=True, exist_ok=True)
    return path


def bundle_prefix(bundle_id: str) -> str:
    return f"bundles/{bundle_id}"


def bundle_dir(bundle_id: str) -> Path:
    path = bundles_root() / bundle_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def content_dir(bundle_id: str) -> Path:
    path = bundle_dir(bundle_id) / "content"
    path.mkdir(parents=True, exist_ok=True)
    return path


def zip_path(bundle_id: str) -> Path:
    return bundle_dir(bundle_id) / f"{bundle_id}.zip"


def manifest_path(bundle_id: str) -> Path:
    return bundle_dir(bundle_id) / "manifest.json"


def index_path() -> Path:
    return storage_root() / "bundle-index.json"
