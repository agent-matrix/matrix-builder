def freshness_score(age_days: int) -> float:
    return round(max(0, min(1, 1 - age_days / 30)), 2)
