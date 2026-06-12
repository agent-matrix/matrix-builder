from __future__ import annotations

import json
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / "packages" / "contracts" / "schemas"
EXAMPLE_DIR = ROOT / "packages" / "contracts" / "examples"

EXAMPLE_TO_SCHEMA = {
    "idea-request.json": "idea-request.schema.json",
    "blueprint-candidate.json": "blueprint-candidate.schema.json",
    "blueprint-result.json": "blueprint-result.schema.json",
    "matrix-bundle.json": "matrix-bundle.schema.json",
    "bundle.json": "matrix-bundle.schema.json",
    "bundle-manifest.json": "bundle-manifest.schema.json",
    "prompt-pack.json": "prompt-pack.schema.json",
    "validation-report.json": "validation-report.schema.json",
    "publication.json": "publication.schema.json",
}


def load_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    for schema_path in sorted(SCHEMA_DIR.glob("*.schema.json")):
        schema = load_json(schema_path)
        Draft202012Validator.check_schema(schema)

    for example_name, schema_name in EXAMPLE_TO_SCHEMA.items():
        example_path = EXAMPLE_DIR / example_name
        schema_path = SCHEMA_DIR / schema_name
        if not example_path.exists():
            raise SystemExit(f"Missing example: {example_path}")
        validator = Draft202012Validator(load_json(schema_path))
        errors = sorted(validator.iter_errors(load_json(example_path)), key=lambda error: list(error.path))
        if errors:
            formatted = "\n".join(f"{example_name}: {'/'.join(map(str, error.path))}: {error.message}" for error in errors)
            raise SystemExit(formatted)

    print("Contract schemas and examples are valid.")


if __name__ == "__main__":
    main()
