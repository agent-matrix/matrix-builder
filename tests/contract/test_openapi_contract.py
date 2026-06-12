from app.main import app


def test_openapi_has_core_routes():
    spec = app.openapi()
    paths = spec["paths"]
    assert "/api/v1/ideas/parse" in paths
    assert "/api/v1/blueprints/candidates" in paths
    assert "/api/v1/blueprints" in paths
    assert "/api/v1/bundles/{bundle_id}" in paths
    assert "/api/v1/standards/current" in paths


def test_openapi_exposes_contract_models():
    schemas = app.openapi()["components"]["schemas"]
    for name in [
        "IdeaRequest",
        "BlueprintCandidate",
        "BlueprintResult",
        "MatrixBundle",
        "PromptResponse",
        "ValidationReport",
        "PublicationResponse",
    ]:
        assert name in schemas
