from app.services.recommender import load_topics

def test_topics_load():
    assert len(load_topics()) >= 3
