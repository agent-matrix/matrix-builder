from __future__ import annotations

from app.services.bundle_service import BundleStore


def run_cleanup() -> int:
    result = BundleStore().cleanup_expired()
    print(f"Deleted {result.deleted_count} expired Matrix Bundles")
    return result.deleted_count


if __name__ == "__main__":
    run_cleanup()
