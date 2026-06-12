import json
from pathlib import Path

def test_dataset_schema():
    data = json.loads(Path('datasets/latest.json').read_text())
    assert 'topics' in data
    assert all('id' in t and 'signals' in t for t in data['topics'])
