#!/usr/bin/env bash
# ===========================================================================
# Matrix Builder — backend CLI demo (the `mb` local-first build loop)
# ===========================================================================
# Drives the Matrix Builder backend from the command line and asserts each
# step of the "git for AI build contracts" loop:
#
#   init  → idea becomes a controlled blueprint
#   next  → plan a scoped batch (allowed files + acceptance)
#   prompt→ render a contract-bound prompt for an AI coder
#   check → validate a change set  (approved → Matrix Commit; forbidden → rejected)
#   timeline → the build history
#
# The `mb` CLI is the local mirror of the control-plane API (services/api).
# It runs fully offline and deterministically — no server, DB, or API key.
#
# Usage:
#   bash scripts/mb_cli_demo.sh
#   IDEA="A todo API" QUALITY=production bash scripts/mb_cli_demo.sh
#
# Requirements: the `mb` CLI on PATH  ->  pip install agent-generator
# Exit code: 0 if every step behaves correctly, 1 otherwise.
# ===========================================================================
set -uo pipefail

IDEA="${IDEA:-A simple hello world web page}"
QUALITY="${QUALITY:-standard}"
CODER="${CODER:-claude-code}"
GOAL="${GOAL:-Implement the hello world page}"

pass=0; fail=0
ok()  { printf '  \033[32m✓\033[0m %s\n' "$1"; pass=$((pass+1)); }
no()  { printf '  \033[31m✗\033[0m %s\n' "$1"; fail=$((fail+1)); }
hdr() { printf '\n\033[1m%s\033[0m\n' "$1"; }

# Pre-flight: the CLI must be installed.
hdr "Pre-flight"
if command -v mb >/dev/null 2>&1; then
  ok "mb is installed ($(mb --version 2>/dev/null | head -1))"
else
  no "mb not found on PATH — run: pip install agent-generator"
  exit 1
fi

# Work in a throwaway directory so we never touch the repo.
WORK="$(mktemp -d "${TMPDIR:-/tmp}/mb-demo.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"

# --- 1. init -------------------------------------------------------------
hdr "1. mb init — idea → controlled blueprint"
if mb init "$IDEA" --quality "$QUALITY" >init.log 2>&1 && [ -f .mb/blueprint.json ]; then
  ok "blueprint + .mb/ workspace created ($(grep -o 'project[[:space:]]*[a-z0-9-]*' init.log | head -1))"
else
  no "mb init failed"; sed 's/^/      /' init.log; exit 1
fi

# --- 2. next -------------------------------------------------------------
hdr "2. mb next — plan a scoped batch"
if mb next "$GOAL" >next.log 2>&1 && grep -q "Batch 01" next.log; then
  ok "batch planned with allowed files + acceptance commands"
else
  no "mb next failed"; sed 's/^/      /' next.log; exit 1
fi

# --- 3. prompt -----------------------------------------------------------
hdr "3. mb prompt — contract-bound prompt for an AI coder"
if mb prompt --coder "$CODER" >prompt.log 2>&1 && grep -q "MATRIX_STATUS" prompt.log; then
  ok "prompt rendered with governing rules + MATRIX_STATUS stop condition"
  [ -f .mb/batches/01/prompts/"$CODER".md ] && ok "prompt + tool-native helper files written to .mb/" \
                                             || no "prompt files not written to .mb/"
else
  no "mb prompt failed"; sed 's/^/      /' prompt.log; exit 1
fi

# --- 4a. check an ALLOWED file -> approved + commit ----------------------
hdr "4a. mb check (allowed file) — expect approved + a Matrix Commit"
allowed="$(grep -oE '[a-zA-Z0-9_./-]+\.(py|tsx|ts|md)' next.log | head -1)"
allowed="${allowed:-backend/app/api/routes.py}"
out="$(mb check "$allowed" 2>&1)"; rc=$?
if grep -q "MATRIX_STATUS: approved" <<<"$out" && grep -qi "commit" <<<"$out"; then
  ok "approved → Matrix Commit created ($(grep -oE 'mc-[a-z0-9]+' <<<"$out" | head -1)); exit=$rc"
else
  no "expected 'approved' + commit for an allowed file"; sed 's/^/      /' <<<"$out"
fi

# --- 4b. check a FORBIDDEN file -> rejected ------------------------------
hdr "4b. mb check (forbidden contract file) — expect rejected (fail-closed)"
out="$(mb check MATRIX_BLUEPRINT.yaml 2>&1)"; rc=$?
if grep -q "MATRIX_STATUS: rejected" <<<"$out"; then
  ok "forbidden change rejected ($(grep -oE 'RMD-[0-9]+' <<<"$out" | head -1)); the contract holds"
else
  no "expected 'rejected' for an immutable contract file"; sed 's/^/      /' <<<"$out"
fi

# --- 5. timeline ---------------------------------------------------------
hdr "5. mb timeline — the build history"
if mb timeline >tl.log 2>&1 && grep -q "Batch 01" tl.log && grep -qi "commit 001" tl.log; then
  ok "timeline shows the batch and its commit"
else
  no "mb timeline did not show the expected history"; sed 's/^/      /' tl.log
fi

# --- summary -------------------------------------------------------------
hdr "Result"
printf '  passed: \033[32m%d\033[0m   failed: \033[31m%d\033[0m\n' "$pass" "$fail"
if [ "$fail" -eq 0 ]; then
  printf '\n\033[32mBackend CLI works end to end.\033[0m The same workflow is exposed over\n'
  printf 'the control-plane API (see docs/backend-cli.md → CLI ↔ HTTP API map).\n'
  exit 0
fi
exit 1
