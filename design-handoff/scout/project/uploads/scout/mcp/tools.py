from app.services.recommender import load_topics, rank_for_location, recommend, get_deep_dive
from app.services.matrix_opportunities import matrix_opportunities

def get_global_trends(limit: int = 10):
    return load_topics()[:limit]

def get_local_trends(country: str, city: str | None = None, limit: int = 10):
    return rank_for_location(country, city)[:limit]

def recommend_topics(country: str, city: str | None, goal: str, profile: str, limit: int = 10):
    return recommend(country, city, goal, profile, limit, depth="explain")

def get_topic_deep_dive(topic_id: str, country: str = "Italy", city: str | None = "Rome"):
    return get_deep_dive(topic_id, country, city, goal="career", profile="developer")

def get_matrix_opportunities(country: str = "Italy", city: str | None = "Rome", goal: str = "create_agents", limit: int = 10):
    return matrix_opportunities(country, city, goal, limit)
