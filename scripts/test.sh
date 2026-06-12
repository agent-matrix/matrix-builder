#!/usr/bin/env bash
set -euo pipefail
export PYTHONPATH="services/api:."
python -m pytest -q tests services/api/tests workers/tests
