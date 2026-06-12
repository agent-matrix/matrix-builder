def normalize_location(country: str | None, city: str | None = None) -> dict:
    return {"country": (country or "Worldwide").strip(), "city": city.strip() if city else None}
