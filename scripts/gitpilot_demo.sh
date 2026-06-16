#!/usr/bin/env bash
# Reproducible end-to-end demo of the Matrix Builder -> GitPilot integration.
#
#   Matrix Builder creates a controlled bundle, hands it to GitPilot, syncs the
#   result, validates it, opens a PR when Matrix approves, and prints metrics.
#
# Usage:
#   BASE_URL=https://ruslanmv-matrix-builder.hf.space/api/builder/api/v1 \
#     scripts/gitpilot_demo.sh
#   # local:  BASE_URL=http://localhost:8000/api/v1 scripts/gitpilot_demo.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000/api/v1}"
IDEA="${IDEA:-A simple Hello World website with a single page that says Hello, World}"
# Defensive JSON getter: prints "" instead of crashing on a missing key / error body.
JQ() { python3 -c "import sys,json
try:
    d=json.load(sys.stdin); print(d$1)
except Exception:
    print('')"; }
POST() { curl -s -m 60 -X POST "$1" -H "content-type: application/json" ${2:+-d "$2"}; }

echo "▶ Matrix Builder → GitPilot demo against: $BASE_URL"

echo "1/6  Create a controlled bundle…"
BID=$(POST "$BASE_URL/bundles" \
  "{\"idea_request\":{\"idea\":\"$IDEA\",\"build_type\":\"app\",\"goal\":\"portfolio\",\"preferred_coder\":\"gitpilot\"},\"preferred_coder\":\"gitpilot\"}" \
  | JQ "['bundle_id']")
echo "    bundle: $BID"

echo "2/6  Start a GitPilot run…"
RID=$(POST "$BASE_URL/bundles/$BID/gitpilot/runs" \
  '{"task_id":"TASK-001","prompt":"Implement Hello World","allowed_files":["tests/**","src/**"]}' \
  | JQ "['run_id']")
echo "    run: $RID"

echo "3/6  Poll the result…"
for _ in $(seq 1 30); do
  S=$(curl -s -m 30 "$BASE_URL/gitpilot/runs/$RID")
  ST=$(echo "$S" | JQ "['status']")
  [ "$ST" = "completed" ] || [ "$ST" = "blocked" ] || [ "$ST" = "error" ] && break
  sleep 2
done
echo "    status: $(echo "$S" | JQ "['status']") | tests: $(echo "$S" | JQ "['test_status']")"

echo "4/6  Matrix validates the diff…"
V=$(POST "$BASE_URL/bundles/$BID/gitpilot/runs/$RID/validate" "{}")
VERDICT=$(echo "$V" | JQ "['gate']['status']")
echo "    verdict: $VERDICT | can_commit: $(echo "$V" | JQ "['gate']['can_commit']")"

echo "5/6  Open a PR (gated on approval)…"
if [ "$VERDICT" = "approved" ]; then
  PR=$(POST "$BASE_URL/bundles/$BID/gitpilot/runs/$RID/pr" '{"repo_url":"https://github.com/acme/hello"}')
  echo "    PR: $(echo "$PR" | JQ "['status']") $(echo "$PR" | JQ "['pr_url']")"
else
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 30 -X POST "$BASE_URL/bundles/$BID/gitpilot/runs/$RID/pr" -H 'content-type: application/json' -d '{}')
  echo "    PR blocked (HTTP $CODE) — Matrix authority requires an approved verdict"
fi

echo "6/6  Metrics summary…"
curl -s -m 30 "$BASE_URL/gitpilot/metrics" | python3 -m json.tool

echo "✓ done"
