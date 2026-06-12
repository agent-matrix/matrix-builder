def merge_signals(*signals: dict) -> dict:
    merged = {}
    for signal in signals:
        merged.update(signal or {})
    return merged
