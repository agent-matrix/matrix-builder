from app.models import SignalBundle

def clamp(value: float) -> float:
    return max(0.0, min(100.0, round(value, 2)))

def trend_score(signals: SignalBundle) -> float:
    return clamp(
        0.30 * signals.github_activity
        + 0.20 * signals.github_growth
        + 0.20 * signals.huggingface_activity
        + 0.10 * signals.news_mentions
        + 0.10 * signals.job_demand
        + 0.10 * signals.community_activity
    )

def actionability_score(signals: SignalBundle) -> float:
    return clamp(
        0.25 * signals.career_value
        + 0.20 * signals.project_potential
        + 0.15 * signals.local_relevance
        + 0.15 * signals.learning_accessibility
        + 0.15 * signals.durability
        + 0.10 * signals.ecosystem_fit
    )

def matrix_value_score(signals: SignalBundle) -> float:
    return clamp(
        0.25 * signals.ecosystem_fit
        + 0.20 * signals.project_potential
        + 0.15 * signals.github_activity
        + 0.15 * signals.career_value
        + 0.10 * signals.news_mentions
        + 0.10 * signals.huggingface_activity
        + 0.05 * signals.community_activity
    )

def final_score(signals: SignalBundle, goal_weight: float = 1.0) -> float:
    return clamp(0.45 * trend_score(signals) + 0.40 * actionability_score(signals) + 0.15 * matrix_value_score(signals) * goal_weight)
