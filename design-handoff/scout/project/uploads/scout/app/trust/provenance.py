from datetime import datetime, timezone

def provenance(source: str, query: str | None = None) -> dict:
    return {"source": source, "query": query, "collected_at": datetime.now(timezone.utc).isoformat()}
