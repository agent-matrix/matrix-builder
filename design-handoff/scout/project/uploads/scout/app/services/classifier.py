def classify(topic: dict) -> tuple[str, list[str]]:
    score = topic.get("score", 0)
    matrix_score = topic.get("matrix_value_score", 0)
    labels = []
    if score >= 88:
        priority = "study_now"
        labels.extend(["study_now", "global_opportunity"])
    elif score >= 78:
        priority = "build_now"
        labels.extend(["build_now", "local_opportunity"])
    elif score >= 65:
        priority = "follow_weekly"
        labels.append("follow_weekly")
    else:
        priority = "monitor_only"
        labels.append("monitor_only")
    if matrix_score >= 85:
        labels.append("agent_matrix_relevant")
    if topic.get("trust", {}).get("hype_risk", 0) > 0.65:
        labels.append("hype_risk")
    return priority, sorted(set(labels))
