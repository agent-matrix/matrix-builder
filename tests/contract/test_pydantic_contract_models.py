from __future__ import annotations

import json
from pathlib import Path

from app.schemas.blueprint import BlueprintCandidate, BlueprintResult
from app.schemas.bundle import MatrixBundle
from app.schemas.idea import IdeaRequest
from app.schemas.prompt import PromptPack
from app.schemas.publication import PublicationResponse
from app.schemas.validation import ValidationReport


def load_example(name: str):
    return json.loads((Path("packages/contracts/examples") / name).read_text(encoding="utf-8"))


def test_pydantic_models_accept_contract_examples():
    assert IdeaRequest.model_validate(load_example("idea-request.json")).idea
    assert BlueprintCandidate.model_validate(load_example("blueprint-candidate.json")).candidate_id
    assert BlueprintResult.model_validate(load_example("blueprint-result.json")).blueprint_id
    assert MatrixBundle.model_validate(load_example("matrix-bundle.json")).bundle_id
    assert PromptPack.model_validate(load_example("prompt-pack.json")).prompts
    assert ValidationReport.model_validate(load_example("validation-report.json")).report_id
    assert PublicationResponse.model_validate(load_example("publication.json")).publication_id


def test_pydantic_models_reject_unknown_contract_fields():
    payload = load_example("idea-request.json")
    payload["unexpected"] = True
    try:
        IdeaRequest.model_validate(payload)
    except Exception as exc:
        assert "unexpected" in str(exc)
    else:
        raise AssertionError("IdeaRequest accepted an unknown field")
