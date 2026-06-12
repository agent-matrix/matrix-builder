from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator

EXAMPLE_TO_SCHEMA = {
    "idea-request.json": "idea-request.schema.json",
    "blueprint-candidate.json": "blueprint-candidate.schema.json",
    "blueprint-result.json": "blueprint-result.schema.json",
    "matrix-bundle.json": "matrix-bundle.schema.json",
    "prompt-pack.json": "prompt-pack.schema.json",
    "validation-report.json": "validation-report.schema.json",
    "publication.json": "publication.schema.json",
}


def test_contract_examples_validate_against_json_schemas():
    schema_dir = Path("packages/contracts/schemas")
    example_dir = Path("packages/contracts/examples")
    for example_name, schema_name in EXAMPLE_TO_SCHEMA.items():
        schema = json.loads((schema_dir / schema_name).read_text(encoding="utf-8"))
        example = json.loads((example_dir / example_name).read_text(encoding="utf-8"))
        Draft202012Validator(schema).validate(example)
