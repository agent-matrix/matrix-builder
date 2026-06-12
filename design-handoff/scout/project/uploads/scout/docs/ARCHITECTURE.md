# Architecture

Scout is a single repository with four layers:

```text
Collectors → Normalization → Scoring/Trust → API + Dashboard + MCP
```

## Committers.top refactor

The original `committers.top` pattern is a Go CLI that uses GitHub location queries and presets to identify active developers by country/region. Scout adapts that idea into:

```text
app/collectors/committers_collector.py
app/data/locations.py
legacy/committers_top/
```

The collector is used as a **location developer signal**, not as a surveillance tool. The public output should be aggregated.

## News-and-trends refactor

The news-and-trends project pattern is adapted into:

```text
scripts/generate_snapshot.py
scripts/publish_to_huggingface.py
datasets/snapshots/
dashboard/
.github/workflows/daily_trends.yml
```

This gives Scout a repeatable daily data pipeline and static publishing path.
