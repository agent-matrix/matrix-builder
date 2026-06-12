# Scout — Developer Trend Intelligence

**Scout** is a public, geolocated trend intelligence API and dashboard for developers, learners, and agentic AI systems.

It answers one practical question:

> Given a person’s location and goals, what IT topics should they follow, study, and build projects around now?

Scout merges two ideas into one repository:

1. **Committers-style backend intelligence** inspired by [`committers.top`](https://github.com/ashkulz/committers.top): location-aware GitHub developer activity and country/city presets.
2. **News-and-trends-style publishing**: scheduled collectors, historical JSON snapshots, static dashboard generation, and data publishing.

The public site can live at:

```text
https://ruslanmv.com/scout/
```

The API can be hosted separately or run locally:

```bash
uvicorn app.main:app --reload
```

## Core features

- Public dashboard for global and local IT trends.
- FastAPI backend with machine-readable endpoints.
- Deep-dive topic pages with evidence, trust, study plans, and project ideas.
- GitHub location intelligence inspired by `committers.top`.
- Hugging Face, news, jobs, community, and committers signal model.
- Hugging Face dataset publishing script.
- Agent-Matrix integration endpoint and MCP server.
- GitHub Actions workflows for tests, daily snapshots, dataset publishing, and Pages export.

## Main endpoints

```text
GET /api/v1/health
GET /api/v1/trends/global
GET /api/v1/trends/location?country=Italy&city=Rome
GET /api/v1/recommendations?country=Italy&city=Rome&goal=career&profile=developer
GET /api/v1/topics/{topic}
GET /api/v1/topics/{topic}/deep-dive
GET /api/v1/matrix/opportunities
GET /api/v1/datasets/latest
GET /api/v1/sources/health
```

## Quick start

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open:

```text
http://127.0.0.1:8000/docs
http://127.0.0.1:8000/dashboard
```

Generate a local snapshot:

```bash
python scripts/generate_snapshot.py
```

Build the static dashboard for GitHub Pages:

```bash
python scripts/export_for_github_pages.py
```

## Repository role

Scout is the developer-facing form of **Matrix Scout**, the trend-intelligence layer for Agent-Matrix.

It converts public technology signals into:

- recommended topics,
- developer study paths,
- portfolio project ideas,
- Agent-Matrix opportunities,
- MCP tools,
- auditable trend datasets.

## Attribution

This repository includes an adapted design inspired by:

- `ashkulz/committers.top` for GitHub location-based contributor discovery.
- `news-and-trends` style scheduled RSS/data/static publishing workflows.

Scout does not claim ownership of those upstream designs. See `NOTICE.md` and `docs/ARCHITECTURE.md`.
