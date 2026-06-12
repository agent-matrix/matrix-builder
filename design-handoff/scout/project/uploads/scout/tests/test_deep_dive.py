from app.services.recommender import get_deep_dive

def test_deep_dive():
    d = get_deep_dive('ai-agents','Italy','Rome','career','developer')
    assert d and 'evidence' in d
