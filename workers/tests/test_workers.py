"""Workers are real and importable (generation/validation run in-process in the API)."""

from workers import worker
from workers.cleanup_worker import run_cleanup
from workers.validation_worker import process_run, run as validation_run


def test_real_workers_are_importable():
    assert validation_run().startswith("validation_worker")
    assert callable(run_cleanup)
    assert callable(process_run)


def test_worker_dispatcher():
    assert worker.main(["help"]) == 0
    assert worker.main(["bogus"]) == 2
