class GitPilotClient:
    def status(self) -> dict[str, str]:
        return {"status": "reserved", "integration": "gitpilot", "mode": "manual-prompt-first"}
