from app.integrations.agent_generator_adapter import AgentGeneratorAdapter
from app.schemas.bundle import BundleGenerationRequest
from app.schemas.common import CoderId
from app.schemas.idea import IdeaRequest


def test_agent_generator_adapter_boundary_exists():
    status = AgentGeneratorAdapter().status()
    assert status["mode"] == "mock"
    assert status["boundary"] == "matrix-builder-orchestrates-agent-generator-generates"


def test_agent_generator_adapter_generates_contract_shapes():
    adapter = AgentGeneratorAdapter()
    idea = IdeaRequest(
        idea="Build a GitHub repository intelligence agent",
        build_type="agent",
        preferred_coder=CoderId.GITPILOT,
    )
    candidates = adapter.generate_blueprint_candidates(idea)
    blueprint = adapter.generate_controlled_blueprint(idea, candidates[1].candidate_id)
    bundle = adapter.generate_matrix_bundle(blueprint, preferred_coder=CoderId.GITPILOT)
    prompt = adapter.generate_coder_prompt(bundle.bundle_id, CoderId.GITPILOT)

    assert len(candidates) == 3
    assert blueprint.standards_lock_ref == "MATRIX_STANDARDS.lock"
    assert any(file.path == "MATRIX_BLUEPRINT.yaml" for file in bundle.files)
    assert "You are not the architect" in prompt.prompt


def test_bundle_generation_request_contract_is_valid():
    request = BundleGenerationRequest(
        idea_request=IdeaRequest(idea="Build a simple developer portfolio reviewer"),
        preferred_coder=CoderId.CLAUDE_CODE,
    )
    assert request.schema_version == "matrix.builder.bundle-generation/v1"
