def trust_label(score: float) -> str:
    if score >= 0.85:
        return "High confidence"
    if score >= 0.65:
        return "Medium confidence"
    if score >= 0.45:
        return "Low confidence"
    return "Experimental"

def compute_trust(source_count: int, freshness_days: int, agreement: float, hype_risk: float) -> dict:
    freshness = max(0, 1 - freshness_days / 30)
    score = max(0, min(1, 0.35 * min(1, source_count / 5) + 0.25 * freshness + 0.30 * agreement - 0.10 * hype_risk))
    return {"score": round(score, 2), "label": trust_label(score), "freshness_days": freshness_days, "source_count": source_count, "agreement": agreement, "hype_risk": hype_risk}
