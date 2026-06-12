from workers.generation_worker import run as generation_run
from workers.validation_worker import run as validation_run


def test_worker_placeholders_are_importable():
    assert generation_run().startswith("generation_worker")
    assert validation_run().startswith("validation_worker")
