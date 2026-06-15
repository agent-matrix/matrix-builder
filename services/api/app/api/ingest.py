"""Ingest router — import an existing source (Path B/C).

POST /ingest/document  — PDF/DOCX/Markdown/TXT → markdown → deterministic ProjectBrief + idea.
(Blueprint-JSON import lives at POST /ingest/blueprint — added in Batch 5.)

The brief never bypasses the engine; the returned `idea` is fed to the existing
/blueprints/candidates flow so the same three controlled tiers are produced.
"""
from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import ValidationError

from app.schemas.blueprint import BlueprintResult
from app.schemas.brief import IngestDocumentResponse
from app.schemas.common import StrictModel
from app.services.brief_builder import brief_to_idea, build_brief
from app.services.document_extractor import (
    DocumentExtractionError,
    UnsupportedDocumentError,
    extract_markdown,
)

router = APIRouter()

_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB
_CONTROL_FILES = ("MATRIX_BLUEPRINT.yaml", "MATRIX_STANDARDS.lock")


class BlueprintImportRequest(StrictModel):
    blueprint: dict


class BlueprintImportResponse(StrictModel):
    valid: bool
    errors: list[str] = []
    blueprint: BlueprintResult | None = None


@router.post("/blueprint", response_model=BlueprintImportResponse)
def ingest_blueprint(payload: BlueprintImportRequest) -> BlueprintImportResponse:
    """Path C — validate a complete user Blueprint JSON. No AI; the JSON is the source of truth.

    Schema-validate against BlueprintResult, then apply Matrix rules: require tasks + allowed roots,
    and always force the control files into forbidden_changes (Matrix owns standards, even here).
    """
    try:
        bp = BlueprintResult.model_validate(payload.blueprint)
    except ValidationError as exc:
        errors = [f"{'.'.join(str(p) for p in e['loc'])}: {e['msg']}" for e in exc.errors()][:25]
        return BlueprintImportResponse(valid=False, errors=errors or ["Invalid blueprint JSON."])

    rule_errors: list[str] = []
    if not bp.tasks:
        rule_errors.append("Blueprint must define at least one task.")
    if not bp.allowed_change_roots:
        rule_errors.append("Blueprint must define allowed_change_roots.")
    if rule_errors:
        return BlueprintImportResponse(valid=False, errors=rule_errors)

    forbidden = list(bp.forbidden_changes)
    for cf in _CONTROL_FILES:
        if cf not in forbidden:
            forbidden.append(cf)
    bp = bp.model_copy(update={"forbidden_changes": forbidden})
    return BlueprintImportResponse(valid=True, errors=[], blueprint=bp)


@router.post("/document", response_model=IngestDocumentResponse)
async def ingest_document(file: UploadFile = File(...)) -> IngestDocumentResponse:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 10 MB).")

    filename = file.filename or ""
    try:
        markdown = extract_markdown(filename, data)
    except UnsupportedDocumentError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc
    except DocumentExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not markdown:
        raise HTTPException(
            status_code=422,
            detail="No readable text found (a scanned/image-only document is not supported).",
        )

    brief = build_brief(markdown, filename, source_type="document")
    return IngestDocumentResponse(
        source_type="document",
        filename=filename,
        markdown=markdown,
        brief=brief,
        idea=brief_to_idea(brief),
    )
