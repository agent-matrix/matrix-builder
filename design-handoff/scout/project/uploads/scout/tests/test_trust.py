from app.services.trust import compute_trust

def test_trust():
    assert compute_trust(5, 1, .9, .1)['score'] > .5
