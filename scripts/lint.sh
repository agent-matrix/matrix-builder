#!/usr/bin/env bash
set -euo pipefail
python scripts/check_repo_structure.py
python scripts/check_no_secrets.py
python scripts/check_python_style.py
python scripts/validate_contracts.py
node scripts/check_frontend.mjs
python -m compileall -q services/api workers scripts tests
