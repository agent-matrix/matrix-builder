from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator


def test_contract_schemas_are_valid_json_schema_2020_12():
    schema_dir = Path("packages/contracts/schemas")
    schemas = list(schema_dir.glob("*.schema.json"))
    assert schemas
    for schema in schemas:
        data = json.loads(schema.read_text(encoding="utf-8"))
        assert data["$schema"] == "https://json-schema.org/draft/2020-12/schema"
        assert data["type"] == "object"
        Draft202012Validator.check_schema(data)


def test_schema_registry_lists_every_schema_file():
    registry = json.loads(Path("packages/contracts/schema-registry.json").read_text(encoding="utf-8"))
    listed = {item["path"] for item in registry["schemas"]}
    actual = {str(path) for path in Path("packages/contracts/schemas").glob("*.schema.json")}
    assert listed == actual
