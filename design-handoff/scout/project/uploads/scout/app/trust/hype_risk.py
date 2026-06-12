def hype_risk(news_score: float, github_score: float, hf_score: float) -> float:
    if news_score > 80 and github_score < 40 and hf_score < 40:
        return 0.8
    return 0.2
