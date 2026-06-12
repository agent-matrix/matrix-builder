"""Location-aware GitHub developer collector inspired by committers.top.

This collector does not copy private data. It queries public GitHub users by location
keywords and can be used to produce aggregated developer activity signals.
"""
from __future__ import annotations
import os
import requests
from app.data.locations import LOCATION_PRESETS

GITHUB_API = "https://api.github.com"

def location_keywords(country: str, city: str | None = None) -> list[str]:
    key = country.lower().replace(" ", "-")
    preset = LOCATION_PRESETS.get(key, [country])
    if city:
        return [city] + preset
    return preset

def search_users_by_location(country: str, city: str | None = None, token: str | None = None, limit: int = 20) -> list[dict]:
    headers = {"Accept": "application/vnd.github+json"}
    token = token or os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    users: dict[str, dict] = {}
    for keyword in location_keywords(country, city)[:6]:
        params = {"q": f"location:{keyword}", "sort": "followers", "order": "desc", "per_page": min(30, limit)}
        try:
            r = requests.get(f"{GITHUB_API}/search/users", headers=headers, params=params, timeout=30)
            r.raise_for_status()
            for item in r.json().get("items", []):
                users[item["login"]] = {"login": item["login"], "html_url": item.get("html_url"), "score": item.get("score", 0), "source_location_keyword": keyword}
        except Exception:
            continue
    return list(users.values())[:limit]

def aggregate_committers_signal(country: str, city: str | None = None) -> dict:
    users = search_users_by_location(country, city, limit=20) if os.getenv("GITHUB_TOKEN") else []
    return {
        "country": country,
        "city": city,
        "developer_count_sample": len(users),
        "sample_users": users,
        "note": "Uses GitHub public search. Set GITHUB_TOKEN for live collection.",
    }
