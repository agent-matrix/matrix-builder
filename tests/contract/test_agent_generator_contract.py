from app.integrations.agent_generator_adapter import AgentGeneratorAdapter


def test_agent_generator_contract_boundary():
    status = AgentGeneratorAdapter().status()
    assert status["mode"] == "mock"
    assert status["status"] == "ready"
    assert status["boundary"] == "matrix-builder-orchestrates-agent-generator-generates"
