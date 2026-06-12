def confidence(source_agreement: float, data_completeness: float, freshness: float) -> float:
    return round(max(0, min(1, 0.4 * source_agreement + 0.35 * data_completeness + 0.25 * freshness)), 2)
