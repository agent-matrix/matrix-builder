import requests

def search_models(query: str, limit: int = 10) -> list[dict]:
    r = requests.get("https://huggingface.co/api/models", params={"search": query, "limit": limit}, timeout=30)
    r.raise_for_status()
    return r.json()
