#!/usr/bin/env bash
# ===========================================================================
# Matrix ecosystem — end-to-end quality check
# ===========================================================================
# Verifies the live program works across services:
#   • matrix-builder  (control plane + UI)
#   • agent-generator (the deterministic generation engine)
#   • gitpilot        (the Matrix-native AI coder backend)
#   • the matrix-builder → agent-generator same-origin proxy (services wired)
#
# It runs the canonical "hello world web page" generation end to end.
#
# Usage:
#   bash scripts/e2e_ecosystem_check.sh
#   MB=https://build.matrixhub.io bash scripts/e2e_ecosystem_check.sh   # override targets
#
# Requirements: bash, curl, python3 (all standard in CI / sandboxes).
# Exit code: 0 if every check passes, 1 otherwise.
# ===========================================================================
set -uo pipefail

MB="${MB:-https://ruslanmv-matrix-builder.hf.space}"
AG="${AG:-https://ruslanmv-agent-generator.hf.space}"
GP="${GP:-https://ruslanmv-gitpilot.hf.space}"
PROMPT="${PROMPT:-A simple hello world web page}"
TIMEOUT="${TIMEOUT:-90}"

pass=0; fail=0
ok()  { printf '  \033[32m✓\033[0m %s\n' "$1"; pass=$((pass+1)); }
no()  { printf '  \033[31m✗\033[0m %s\n' "$1"; fail=$((fail+1)); }
hdr() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# status URL [METHOD] [JSON_BODY]
status() {
  local url="$1" method="${2:-GET}" body="${3:-}"
  if [ "$method" = "GET" ]; then
    curl -sS -m "$TIMEOUT" -o /dev/null -w '%{http_code}' "$url" 2>/dev/null
  else
    curl -sS -m "$TIMEOUT" -o /dev/null -w '%{http_code}' -X "$method" "$url" \
      -H 'content-type: application/json' -d "$body" 2>/dev/null
  fi
}

# check_status "label" URL [expected=200]
check_status() {
  local label="$1" url="$2" want="${3:-200}"
  local code; code="$(status "$url")"
  if [ "$code" = "$want" ]; then ok "$label ($code)"; else no "$label (got $code, want $want)"; fi
}

# get_json_check "label" URL PYEXPR  — GET, parse JSON, PYEXPR(dict d) prints "OK ..." on success
get_json_check() {
  local label="$1" url="$2" pyexpr="$3" out
  out="$(curl -sS -m "$TIMEOUT" "$url" 2>/dev/null | python3 -c "import sys,json
try:
    d=json.load(sys.stdin)
except Exception as e:
    print('ERR not-json:', e); sys.exit(0)
$pyexpr" 2>/dev/null)"
  if printf '%s' "$out" | grep -q '^OK'; then ok "$label — ${out#OK }"; else no "$label — ${out:-no response}"; fi
}

# post_json_check "label" URL JSON_BODY PYEXPR  — PYEXPR receives parsed dict `d`, must print "OK ..." or raise
post_json_check() {
  local label="$1" url="$2" body="$3" pyexpr="$4"
  local out
  out="$(curl -sS -m "$TIMEOUT" -X POST "$url" -H 'content-type: application/json' -d "$body" 2>/dev/null \
    | python3 -c "import sys,json
try:
    d=json.load(sys.stdin)
except Exception as e:
    print('ERR not-json:', e); sys.exit(0)
$pyexpr" 2>/dev/null)"
  if printf '%s' "$out" | grep -q '^OK'; then ok "$label — ${out#OK }"; else no "$label — ${out:-no response}"; fi
}

printf '\033[1mMatrix ecosystem E2E quality check\033[0m\n'
printf 'MB=%s\nAG=%s\nGP=%s\nprompt="%s"\n' "$MB" "$AG" "$GP" "$PROMPT"

hdr "1. matrix-builder (control plane + UI)"
check_status "UI /matrix-builder"            "$MB/matrix-builder"
check_status "API /api/builder/health"       "$MB/api/builder/health"
get_json_check "auth status (google+email)" "$MB/api/builder/api/v1/auth/status" \
  "print('OK google='+str(d.get('google_enabled'))+' email='+str(d.get('email_enabled'))) if d.get('google_enabled') is not None else print('no status')"

hdr "2. agent-generator (generation engine)"
check_status "health /api/health" "$AG/api/health"
post_json_check "plan: '$PROMPT'" "$AG/api/plan" "{\"prompt\":\"$PROMPT\"}" \
  "s=d.get('spec',{}); print('OK name='+str(s.get('name'))+' framework='+str(s.get('framework'))) if s.get('name') else print('no spec')"
post_json_check "generate produces files" "$AG/api/generate" "{\"prompt\":\"$PROMPT\"}" \
  "f=(d.get('artifacts') or {}).get('files') or {}; n=len(f); print(('OK '+str(n)+' files: '+', '.join(list(f)[:4])) if n else 'no files')"

hdr "3. gitpilot (AI coder backend)"
get_json_check "backend health" "$GP/api/health" \
  "print('OK '+str(d.get('status'))+' ('+str(d.get('service'))+')') if d.get('status')=='healthy' else print('unhealthy')"

hdr "4. wiring: matrix-builder → agent-generator (same-origin proxy)"
check_status "proxy /api/agent-generator/api/health" "$MB/api/agent-generator/api/health"
post_json_check "full chain: plan via matrix-builder" "$MB/api/agent-generator/api/plan" "{\"prompt\":\"$PROMPT\"}" \
  "s=d.get('spec',{}); print('OK name='+str(s.get('name'))) if s.get('name') else print('no spec')"

hdr "Result"
printf '  %s passed, %s failed\n' "$pass" "$fail"
if [ "$fail" -gt 0 ]; then printf '\033[31mE2E quality check FAILED\033[0m\n'; exit 1; fi
printf '\033[32mE2E quality check PASSED\033[0m\n'
