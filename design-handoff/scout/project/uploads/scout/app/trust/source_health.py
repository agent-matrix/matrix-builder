def source_health() -> dict:
    return {
        "github": {"status": "configured_if_GITHUB_TOKEN_set", "role": "developer activity"},
        "huggingface": {"status": "public_api", "role": "AI builder activity"},
        "news": {"status": "rss_configurable", "role": "market and research signal"},
        "jobs": {"status": "placeholder", "role": "local demand"},
        "community": {"status": "placeholder", "role": "local community signal"},
        "committers": {"status": "github_location_search", "role": "location developer activity"},
    }
