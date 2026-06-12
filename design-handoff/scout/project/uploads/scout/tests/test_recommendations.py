from app.services.recommender import recommend

def test_recommend():
    assert recommend('Italy','Rome','career','developer',3)
