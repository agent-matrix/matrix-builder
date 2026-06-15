# OllaBridge Internal AI (optional assist)

Matrix Builder ships with an **optional** Internal AI assistant powered by
[OllaBridge](https://app.ollabridge.com). It is **off by default**. When off — the default — the
product runs exactly as it does today: fully deterministic, no API key, no network calls to any
model.

This feature exists only to make the experience *feel* smarter. It can improve the words a user
reads; it can never change the contract a user builds from.

> **Internal AI can improve the words users see, but it cannot change the contract users build from.**

See [`ai-ownership.md`](./ai-ownership.md) for the full deterministic-vs-internal-vs-external policy.

---

## What it is (and is not)

| | Internal AI (this feature) | External AI coder |
| --- | --- | --- |
| Who runs it | Matrix Builder, via the user's OllaBridge connection | The user, in their own tool |
| Job | Improve candidate wording; explain validation findings | Write the actual code |
| Authority | **None** over contracts/validation | Produces code; Matrix validates it |
| Default | Off (`provider: none`) | Manual copy-paste prompt |

This task implements **Internal AI only**. Managed external AI coding (running the user's coder for
them) is future work and is intentionally not built here.

---

## Where to configure it

Account menu → **Settings** → **System Configuration**.

```
Profile
Security
Account access
System Configuration   ← AI Provider lives here
Danger zone
```

- **AI Provider**: `🌉 OllaBridge` or `None` (default `None`).
- When `None`: "AI assist is off. Matrix Builder will run deterministically." No fields, no calls.
- When `OllaBridge`: an **Enable AI assist (assisted mode)** toggle plus API Configuration appear.

### API Configuration

- **Authentication mode**: `Device Pairing` (default), `API Key`, or `Local Trust`.
- **Base URL (root only, no /v1)** — default `https://app.ollabridge.com`. A value ending in `/v1`
  is rejected (the client appends `/v1/...` itself).
- **Model** — default `qwen2.5:1.5b`. **Fetch Models** lists `GET {baseUrl}/v1/models` and keeps
  the current selection if still offered.

#### Device Pairing
Enter the OllaBridge pairing code and click **Pair**. The code is normalized (trimmed, uppercased,
hyphens and spaces removed) and posted to `POST {baseUrl}/pair` as
`{ "code": "...", "label": "matrix-builder" }`. On success the returned token is stored as
`pairToken` and **never displayed**; it is later sent as `Authorization: Bearer <token>`.

#### API Key
Stored locally and sent as `Authorization: Bearer <apiKey>`. Never shown in plain text after save.

#### Local Trust
No `Authorization` header is sent. Allowed **only** for localhost-like base URLs
(`http://localhost`, `http://127.0.0.1`, `http://0.0.0.0`); blocked for remote URLs.

---

## Storage and privacy

- Settings live in the browser only, under `localStorage["matrix-builder:ai-settings:v1"]`, **separate
  from** account/profile settings and the auth token.
- Tokens and API keys are **never** sent to the Matrix Builder backend and **never** stored
  server-side (Phase 3 cloud persistence is deferred).
- Deleting your account (Danger zone) also clears this browser key.
- Source code and Matrix Bundle ZIPs are **never** sent to OllaBridge. Enrichment receives only the
  idea text and the candidates' `id / tier / name / summary`.

---

## How assist is wired (display-only)

Both integration points are **fail-open**: any error, timeout, or `provider: none` returns the
deterministic result unchanged.

1. **Candidate display enrichment** — after the deterministic engine returns the three candidates,
   assisted mode may rewrite `displayName` / `displaySummary` / `displayRationale` only. The
   original deterministic candidate object (which drives bundle generation) is never mutated;
   overrides are stored separately by `id`. Enriched cards show an **"AI-assisted wording"** badge.
   Forbidden to change: `id, tier, stack, files, tasks, allowed files, forbidden files, standards,
   bundle, prompt, validation`.

2. **Validation explanation** — after deterministic validation returns `approved / needs_repair /
   rejected` with a score and findings, assisted mode may add a plain-language explanation. The
   status, score, and findings shown to the user always come from the validator — the AI text is
   helper copy only and is labelled "AI explanation (assist)".

---

## Modes vs `AGENT_GENERATOR_MODE`

These are orthogonal:

- `AGENT_GENERATOR_MODE=mock|sdk` (backend env) selects **which deterministic engine** runs. It is
  **not** an AI switch — both modes are deterministic.
- The AI Provider setting (browser) selects whether the **optional internal assistant** is used.

---

## Reference

Adapted from [`ruslanmv/3D-Avatar-Chatbot`](https://github.com/ruslanmv/3D-Avatar-Chatbot) — the AI
provider settings UI (`index.html`) and `src/LLMManager.js` (provider constants, localStorage
persistence, model fetching, OpenAI-compatible chat, `/pair` pairing-code normalization). Only the
provider/connection pattern was adapted, reduced to `None` and `OllaBridge`; no avatar, VR, speech,
persona, or WebXR code was used.

---

## End-to-end CI test — `scripts/e2e_ollabridge_hello_world.mjs`

This is the **frontend CI smoke test for the cloud version** of Matrix Builder. It builds a
"hello world" website through the whole loop with OllaBridge performing **both** AI roles, so a
single run proves the deployed product actually works.

Crucially, it runs the **exact browser code the UI ships** — it imports `@/lib/ollabridge-client`
and `@/lib/ai-provider-manager` (the same modules `AiConfigurationSection` and `MatrixBuilderClient`
use). So a green run means the cloud frontend's OllaBridge integration is wired correctly against the
real OllaBridge API and the real engine — not a mock.

### What it asserts (14 checks)

| Step | Layer | Assertion |
| --- | --- | --- |
| 0–1 | OllaBridge | device-pairing token works; `/v1/models` returns a non-empty list |
| 2 | Deterministic | idea parses; engine returns exactly **3 candidates** |
| 3 | **Internal AI** | OllaBridge enriches candidate copy; enrichment carries **only** `display*` fields (no `id/tier/stack/files` leakage) |
| 4 | Deterministic | Matrix Bundle compiles; coder prompt is fetched |
| 5 | **External AI coder** | OllaBridge returns a hello-world implementation from the prompt |
| 6 | Deterministic (judge) | in-scope change → **APPROVED (score 100)** |
| 7 | Deterministic (judge) | forbidden control-file edit → **REJECTED**, control-file finding raised |
| 8 | **Internal AI** | OllaBridge explains the rejection in plain language (text only) |

### Environment variables

| Var | Required | Default | Purpose |
| --- | --- | --- | --- |
| `OLLABRIDGE_TOKEN` | one of these | — | a paired device token (from Settings → Device Pairing) |
| `OLLABRIDGE_PAIR_CODE` | one of these | — | a fresh device code; the script pairs inline to get a token |
| `OLLABRIDGE_BASE_URL` | no | `https://app.ollabridge.com` | OllaBridge root (no `/v1`) |
| `OLLABRIDGE_MODEL` | no | `qwen2.5:1.5b` | model/route alias for the AI calls |
| `MB_API` | no | `http://127.0.0.1:8011` | engine API base — point at the **cloud API** for a true cloud smoke test |

The token is read from the environment only — **never stored, never printed**. If **neither**
`OLLABRIDGE_TOKEN` nor `OLLABRIDGE_PAIR_CODE` is set, the script prints `SKIPPED` and exits `0`, so
fork PRs and contributors without the secret never break the build. Exit codes: `0` = passed or
skipped, `1` = a check failed or a hard error.

### Two ways to run it in CI

**A. Against the deployed cloud API (recommended cloud smoke test).** No backend to spin up — point
`MB_API` at the Hugging Face Space that serves the cloud engine and let the test exercise the live
stack end to end:

```bash
OLLABRIDGE_TOKEN="$OLLABRIDGE_TOKEN" \
MB_API="https://ruslanmv-matrix-builder.hf.space/api/builder" \
node --experimental-strip-types --import ./apps/web/test/setup.mjs \
  scripts/e2e_ollabridge_hello_world.mjs
```

**B. Against a local engine (hermetic).** Bring the engine up in `sdk` mode (the real engine, not the
dev mock) and let `MB_API` default to localhost:

```bash
AGENT_GENERATOR_MODE=sdk MATRIX_DEFINITIONS_MODE=mock \
  PYTHONPATH=services/api python -m uvicorn app.main:app --host 127.0.0.1 --port 8011 &
# wait for /api/v1/health, then:
OLLABRIDGE_TOKEN="$OLLABRIDGE_TOKEN" \
node --experimental-strip-types --import ./apps/web/test/setup.mjs \
  scripts/e2e_ollabridge_hello_world.mjs
```

### GitHub Actions workflow

Add a repo secret `OLLABRIDGE_TOKEN` (Settings → Secrets and variables → Actions → New repository
secret). Tokens are device-scoped and can be revoked from the OllaBridge dashboard. Then drop this in
`.github/workflows/e2e-ollabridge.yml`:

```yaml
name: E2E — OllaBridge (cloud frontend smoke)
on:
  workflow_dispatch:        # run on demand
  schedule:
    - cron: "0 6 * * *"     # and once a day
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"   # needs --experimental-strip-types
      - name: Run cloud E2E (token-gated; skips cleanly without the secret)
        env:
          OLLABRIDGE_TOKEN: ${{ secrets.OLLABRIDGE_TOKEN }}
          MB_API: https://ruslanmv-matrix-builder.hf.space/api/builder
        run: |
          node --experimental-strip-types --import ./apps/web/test/setup.mjs \
            scripts/e2e_ollabridge_hello_world.mjs
```

Notes:
- Prefer `workflow_dispatch` / `schedule` over `on: push` so external AI calls aren't made on every
  commit. If you do want it on PRs, the clean-skip keeps fork PRs (no secret) green.
- For the hermetic variant (B), add a Python setup step plus an `agent-generator` install, start the
  engine with `AGENT_GENERATOR_MODE=sdk`, poll `/api/v1/health`, and drop the `MB_API` env so it
  defaults to `127.0.0.1:8011`.
- Node 24+ runs `.ts` without the flag; on Node 22 keep `--experimental-strip-types`.

### Expected output (abridged)

```
[1] OllaBridge /v1/models
   ✓ listed 12 models (selected qwen2.5:1.5b)
[3] Internal AI (OllaBridge): enrich candidate copy — display-only
   ✓ enriched 3 candidate(s)
   ✓ enrichment carries ONLY display fields (no id/tier/stack/files leakage)
[5] External AI coder (OllaBridge): implement the batch from the prompt
   ✓ coder returned an implementation
[6] Engine: validate in-scope change → expect APPROVED
   ✓ status=approved score=100
[7] Engine: validate forbidden control-file edit → expect REJECTED
   ✓ status=rejected score=65
────────────────────────────────────────────────────────────
Result: 14 passed, 0 failed
```

### Troubleshooting

- `SKIPPED …` — no credential set; add `OLLABRIDGE_TOKEN` (or `OLLABRIDGE_PAIR_CODE`).
- Pairing `4xx` — the device code expired (~10 min). Generate a fresh one and use
  `OLLABRIDGE_PAIR_CODE`, or pair once in the UI and reuse the longer-lived `OLLABRIDGE_TOKEN`.
- `… → 404/connection refused` on engine calls — `MB_API` is wrong or the local engine isn't up.
- Enrichment step shows "empty → deterministic copy kept" — that is still a **pass** (fail-open): the
  model returned no usable JSON and the UI would fall back to deterministic copy.

## Unit tests

`apps/web/src/lib/__tests__/ai-settings.test.ts` (run `npm run test` in `apps/web`) covers:
defaults to `none`, localStorage persistence, malformed-JSON fallback, base-URL `/v1` rejection,
pairing-code normalization, token stored-but-not-exposed, `/v1/models` + `/v1/chat/completions`
endpoints, provider `none` makes zero AI calls, OllaBridge failure falls back deterministically, and
enrichment cannot change `id/tier/stack/files` or validation `status/score/findings`.
