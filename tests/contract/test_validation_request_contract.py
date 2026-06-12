import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]


def test_validation_request_examples_validate_against_schema():
    schema = json.loads((ROOT / "packages/contracts/schemas/validation-request.schema.json").read_text())
    validator = Draft202012Validator(schema)
    for name in ["validation-request-approved.json", "validation-request-rejected.json"]:
        payload = json.loads((ROOT / "packages/contracts/examples" / name).read_text())
        validator.validate(payload)
