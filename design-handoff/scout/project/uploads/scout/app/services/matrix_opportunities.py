from app.services.recommender import rank_for_location

def matrix_opportunities(country: str, city: str | None, goal: str, limit: int = 10) -> dict:
    topics = rank_for_location(country, city)
    opportunities = []
    for t in topics[:limit]:
        opportunities.append({
            "topic": t["name"],
            "topic_id": t["id"],
            "matrix_value_score": t.get("matrix_value_score", 0),
            "recommended_artifact": f"{t['name']} MCP server + tutorial + dataset snapshot",
            "recommended_agent": f"{t['name']} Scout Agent",
            "priority": "build_now" if t.get("matrix_value_score", 0) >= 85 else t.get("priority"),
            "reason": "High value for Agent-Matrix knowledge creation and reusable agent capabilities.",
        })
    return {"location": {"country": country, "city": city}, "goal": goal, "opportunities": opportunities}
