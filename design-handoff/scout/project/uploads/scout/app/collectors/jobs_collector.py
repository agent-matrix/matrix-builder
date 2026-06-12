def collect_jobs_signal(topic: str, country: str | None = None, city: str | None = None) -> dict:
    return {"topic": topic, "country": country, "city": city, "mentions": 0, "note": "Placeholder: connect public job APIs or curated CSV imports."}
