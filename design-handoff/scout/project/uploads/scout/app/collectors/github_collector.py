from __future__ import annotations
import os
import requests

GITHUB_API = "https://api.github.com"

def search_repositories(topic: str, token: str | None = None, per_page: int = 10) -> dict:
    headers = {"Accept": "application/vnd.github+json"}
    token = token or os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    params = {"q": topic, "sort": "updated", "order": "desc", "per_page": per_page}
    response = requests.get(f"{GITHUB_API}/search/repositories", headers=headers, params=params, timeout=30)
    response.raise_for_status()
    return response.json()
