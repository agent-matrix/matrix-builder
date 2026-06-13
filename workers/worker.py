"""Matrix Builder out-of-process worker dispatcher.

Long-running validation/generation execute *in-process* in the API
(``app.runtime.run_worker``), fed by ``POST /api/v1/batches/{id}/runs``. This dispatcher runs the
genuinely out-of-process maintenance job — expiring old guest/free bundles — on a schedule
(cron / Kubernetes CronJob)::

    python -m workers.worker cleanup
"""

from __future__ import annotations

import sys

_USAGE = "Matrix Builder worker. Commands:\n  cleanup   Delete expired Matrix Bundles"


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    cmd = args[0] if args else "help"
    if cmd == "cleanup":
        from workers.cleanup_worker import run_cleanup

        run_cleanup()
        return 0
    print(_USAGE)
    return 0 if cmd in ("help", "-h", "--help") else 2


if __name__ == "__main__":
    raise SystemExit(main())
