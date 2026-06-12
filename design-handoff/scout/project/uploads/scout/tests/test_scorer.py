from app.models import SignalBundle
from app.services.scorer import trend_score

def test_score():
    assert trend_score(SignalBundle(github_activity=100)) == 30
