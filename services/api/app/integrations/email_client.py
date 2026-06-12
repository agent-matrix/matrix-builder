class EmailClient:
    def status(self) -> dict[str, str]:
        return {"status": "reserved", "integration": "email"}
