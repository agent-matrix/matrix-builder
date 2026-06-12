def redact_secret(value: str) -> str:
    return "***" if value else value
