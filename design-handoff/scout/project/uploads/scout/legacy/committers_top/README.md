# Committers.top backend adaptation

This folder documents how Scout refactors the core idea from `committers.top`:

- location presets,
- GitHub public user search,
- developer activity by country/city,
- generated outputs for dashboards and badges.

Scout's active implementation is Python-based:

```text
app/collectors/committers_collector.py
app/data/locations.py
```

This keeps the repository simple while preserving the `committers.top` backend idea as one Scout signal.
