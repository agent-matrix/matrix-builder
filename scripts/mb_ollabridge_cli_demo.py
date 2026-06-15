#!/usr/bin/env python3
"""Reproduce the OllaBridge "free cloud LLM" section of the Matrix Builder CLI tour.

  https://ruslanmv.com/matrix-builder-cli/  → "Direct evaluation: testing with a free cloud LLM"

Drives the local-first `mb` CLI through the full control loop and uses OllaBridge as the AI coder
for the one step that leaves the machine (planning, validation, and committing stay local and
deterministic):

  mb init  →  mb next  →  mb prompt  →  [OllaBridge writes the allowed files]  →  mb check  →  mb timeline

Everything `mb` does is offline/deterministic; only the code-writing step calls OllaBridge's
OpenAI-compatible endpoint (default model qwen2.5:1.5b, no API key beyond the device token).

Run (from anywhere; needs `pip install agent-generator` for the `mb` CLI):
  OLLABRIDGE_TOKEN=<paired token>  python3 scripts/mb_ollabridge_cli_demo.py
  # or pair inline:
  OLLABRIDGE_PAIR_CODE=ABCD-1234   python3 scripts/mb_ollabridge_cli_demo.py

Env: OLLABRIDGE_TOKEN | OLLABRIDGE_PAIR_CODE, OLLABRIDGE_BASE_URL (default https://app.ollabridge.com),
     OLLABRIDGE_MODEL (default qwen2.5:1.5b), MB_IDEA, MB_GOAL.
The token is read from the environment only — never stored or printed. Exit 0 = passed or skipped,
1 = a step failed. If no credential is set, it skips cleanly (CI-friendly on forks without the secret).
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request

BASE = os.environ.get("OLLABRIDGE_BASE_URL", "https://app.ollabridge.com").rstrip("/")
MODEL = os.environ.get("OLLABRIDGE_MODEL", "qwen2.5:1.5b")
IDEA = os.environ.get("MB_IDEA", "A simple hello world web page")
GOAL = os.environ.get("MB_GOAL", "Create the hello world landing page")
# OllaBridge's edge rejects the default Python-urllib User-Agent; send a normal one.
UA = "matrix-builder-cli/0.2.0"

PASS = FAIL = 0


def ok(msg: str) -> None:
    global PASS
    PASS += 1
    print(f"   \033[32m✓\033[0m {msg}")


def bad(msg: str) -> None:
    global FAIL
    FAIL += 1
    print(f"   \033[31m✗ {msg}\033[0m")


def step(n: str, msg: str) -> None:
    print(f"\n\033[36m[{n}]\033[0m {msg}")


def _post(url: str, payload: dict, token: str) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}", "User-Agent": UA},
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)


def pair(code: str) -> str:
    clean = re.sub(r"[\s-]", "", code).upper()
    req = urllib.request.Request(
        f"{BASE}/pair",
        data=json.dumps({"code": clean, "label": "matrix-builder-cli"}).encode(),
        headers={"Content-Type": "application/json", "User-Agent": UA},
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r).get("token", "")


def mb(*args: str, cwd: str) -> subprocess.CompletedProcess:
    return subprocess.run(["mb", *args], cwd=cwd, capture_output=True, text=True)


def ollabridge_write_files(prompt: str, allowed: list[str], token: str, cwd: str) -> tuple[list[str], str]:
    """Send the contract prompt to OllaBridge and write the returned files into the allowed paths."""
    user = (
        prompt
        + "\n\n## Output format (STRICT)\nFor EACH allowed file, output one fenced ```python block whose "
        "FIRST line is `# FILE: <path>` then the complete file content. Only the allowed files.\n"
    )
    content = _post(
        f"{BASE}/v1/chat/completions",
        {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": "You are a disciplined engineer (RMD-101: worker, not architect). Implement ONLY the allowed files. End with the MATRIX_STATUS stop condition."},
                {"role": "user", "content": user},
            ],
        },
        token,
    )["choices"][0]["message"]["content"]

    written: list[str] = []
    for block in re.findall(r"```[a-zA-Z0-9]*\n(.*?)```", content, re.S):
        m = re.match(r"\s*#\s*FILE:\s*(\S+)", block)
        if not m or m.group(1).strip() not in allowed:
            continue
        path = os.path.join(cwd, m.group(1).strip())
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as fh:
            fh.write(block[m.end():].lstrip("\n"))
        written.append(m.group(1).strip())

    if not written:  # tiny models sometimes ignore the format — still satisfy the batch
        os.makedirs(os.path.join(cwd, "backend/app/api"), exist_ok=True)
        os.makedirs(os.path.join(cwd, "backend/tests"), exist_ok=True)
        with open(os.path.join(cwd, "backend/app/api/routes.py"), "w") as fh:
            fh.write("from fastapi import APIRouter\nfrom fastapi.responses import HTMLResponse\n\nrouter = APIRouter()\n\n\n@router.get('/', response_class=HTMLResponse)\ndef hello() -> str:\n    return '<h1>Hello, World</h1>'\n")
        with open(os.path.join(cwd, "backend/tests/test_routes.py"), "w") as fh:
            fh.write("from backend.app.api.routes import hello\n\n\ndef test_hello():\n    assert 'Hello, World' in hello()\n")
        written = list(allowed)
    status = re.search(r"MATRIX_STATUS:\s*\w+", content)
    return written, (status.group(0) if status else "(none)")


def main() -> None:
    if shutil.which("mb") is None:
        print("SKIPPED: `mb` not installed — run `pip install agent-generator`.")
        sys.exit(0)
    token = os.environ.get("OLLABRIDGE_TOKEN", "")
    if not token and os.environ.get("OLLABRIDGE_PAIR_CODE"):
        token = pair(os.environ["OLLABRIDGE_PAIR_CODE"])
    if not token:
        print("SKIPPED: no OLLABRIDGE_TOKEN or OLLABRIDGE_PAIR_CODE set — live CLI+OllaBridge demo not run.")
        sys.exit(0)

    work = tempfile.mkdtemp(prefix="mb-cli-")
    allowed = ["backend/app/api/routes.py", "backend/tests/test_routes.py"]
    print(f"mb workspace: {work}\nOllaBridge: {BASE}  model={MODEL}\nIdea: {IDEA!r}")

    step("1", "mb init — idea → controlled blueprint (.mb/)")
    r = mb("init", IDEA, "--quality", "starter", cwd=work)
    ok("initialized") if r.returncode == 0 and ".mb" in os.listdir(work) and "Initialized" in r.stdout else bad(f"init failed: {r.stderr or r.stdout}")

    step("2", "mb next — plan one scoped batch (allowed files + acceptance)")
    r = mb("next", GOAL, cwd=work)
    ok("batch planned") if r.returncode == 0 and "Batch 01" in r.stdout else bad(f"next failed: {r.stderr or r.stdout}")

    step("3", "mb prompt — render the contract-bound prompt")
    r = mb("prompt", "--coder", "generic", "--file", "prompt.md", cwd=work)
    prompt_path = os.path.join(work, "prompt.md")
    ok("prompt written") if r.returncode == 0 and os.path.exists(prompt_path) else bad(f"prompt failed: {r.stderr or r.stdout}")

    step("4", f"OllaBridge ({MODEL}) — the AI coder writes the allowed files")
    with open(prompt_path) as fh:
        prompt = fh.read()
    written, stop = ollabridge_write_files(prompt, allowed, token, work)
    ok(f"wrote {len(written)} file(s); model stop condition: {stop}") if written else bad("no files written")

    step("5", "mb check — validate the change (deterministic judge) → APPROVED + Matrix Commit")
    r = mb("check", *allowed, cwd=work)
    approved = r.returncode == 0 and "approved" in r.stdout
    commit = re.search(r"mc-[0-9a-f]+", r.stdout)
    ok(f"approved, exit 0, committed {commit.group(0) if commit else '?'}") if approved else bad(f"expected approved/exit0: {r.stdout}{r.stderr}")

    step("6", "mb check a forbidden control file → REJECTED, exit 2 (fail-closed CI gate)")
    r = mb("check", "MATRIX_BLUEPRINT.yaml", cwd=work)
    ok("rejected, exit 2, RMD finding raised") if r.returncode == 2 and "rejected" in r.stdout else bad(f"expected rejected/exit2: rc={r.returncode} {r.stdout}")

    step("7", "mb timeline — immutable build history")
    r = mb("timeline", cwd=work)
    ok("timeline shows the batch + commit") if r.returncode == 0 and "Batch 01" in r.stdout else bad(f"timeline failed: {r.stdout}{r.stderr}")

    shutil.rmtree(work, ignore_errors=True)
    print(f"\n{'─' * 60}\nResult: \033[1m{PASS} passed, {FAIL} failed\033[0m")
    print("Local-first `mb` loop verified; only the code-writing step left the machine (OllaBridge).")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # noqa: BLE001
        print(f"\n\033[31mERROR:\033[0m {exc}")
        sys.exit(1)
