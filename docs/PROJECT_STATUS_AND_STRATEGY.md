# Matrix Builder — Architecture Review, Integration Strategy & Worldwide Growth Plan

Author: AI Systems Architect / Strategic PM review · Date: 2026-06-13
Owner: **Ruslan Magana Vsevolodovna** (ruslanmv.com) · Org: agent-matrix

> **Thesis.** As AI writes more of the world's code, the bottleneck moves from *generation* to
> **control**. Matrix Builder gives AI coders **a contract, not a prompt** — a blueprint, locked
> standards, an allowed-changes scope, and a validation gate. The **Matrix Standard** is the open
> spec; Matrix Builder is the control plane; MatrixHub is the trusted registry. This is a category
> play, not a demo.

Repositories under review:
- `agent-matrix/matrix-builder` (branch `claude/confident-einstein-fz3hcy`) — control plane.
- `agent-matrix/matrix-definitions` — the standard (schemas + signed pack `2026.06.0`).
- `ruslanmv/agent-generator` (branch `claude/confident-einstein-fz3hcy`) — engine v1.1.0 + `mb`.
- `agent-matrix/matrix-hub` (+ `matrixhub`, `matrix-hub-admin`) — registry.
- `ruslanmv/gitpilot` — the Matrix-native AI coder.

---

## 0. Current state (verified this cycle)

- **Build:** `make install` is **uv-based** (fast; pip fallback) from `requirements.txt`;
  `make migrate` runs **real Alembic migrations** (Aiven-aware via `MIGRATION_DATABASE_URL`).
- **Tests:** **75 passing** across `tests`, `services/api/tests`, `workers/tests`. Frontend lint +
  **typecheck clean** (`zip.ts` Blob cast fixed; unused `tailwind.config.ts` removed).
- **Production hardening:** placeholders removed; the 7 batch-1 web routes redirect to real flows or
  carry real docs; `worker.py` is a real dispatcher; vestigial marker workers deleted.
- **Architecture:** end-to-end controlled build loop on **Aiven PostgreSQL 17** with **per-user
  RLS**; `agent-generator v1.1.0` (idea→blueprint→bundle→validate→repair→commit→publish),
  `matrix-builder` (`/v1` workflow API + WebSocket streaming), `matrix-definitions` (pack 2026.06.0),
  `matrix-hub` (registry), `gitpilot` (coder).
- **Aiven instance `pg-3113274d`:** PG 17.10 (EOL 2029-11), **1 CPU / 1 GB RAM / 1 GB storage**,
  **connection limit 20**, ~84% memory, backups in `do-sfo2`. Free tier → integrations/read-replica
  need a **startup plan**; the **$5/mo** bump adds storage, Basic support, and prevents idle
  power-offs. These constraints drive the scaling design in §4–§5.

> 🔴 **CRITICAL SECURITY (do first):** the `avnadmin` password was exposed in chat. **Rotate it in
> the Aiven console now.** The application must connect as the least-privilege **`matrix_app`** role
> (`services/api/scripts/aiven_setup.sql`), never `avnadmin`. Generate a ≥32-byte `MB_JWT_SECRET`.
> No DSN/secret is committed anywhere (verified); keep it that way.

---

## Phase 1 — Integration Architecture: how the Matrix Standard plugs into every AI coder

### 1.1 The integration model (one contract, five surfaces)

The Matrix contract is **tool-agnostic**. We meet each coder where it lives, through five reusable
surfaces (all already produced by `agent-generator.coder_handoff` and the bundle compiler):

1. **Control files** (the contract itself): `MATRIX_BLUEPRINT.yaml`, `MATRIX_STANDARDS.lock`,
   `MATRIX_TASKS.md`, `MATRIX_ALLOWED_CHANGES.md`, `MATRIX_ACCEPTANCE_CRITERIA.md`,
   `MATRIX_VALIDATION.md`.
2. **Tool-native helper files** the agent reads automatically: `CLAUDE.md` (Claude Code),
   `AGENTS.md` (Codex/Cursor), `MATRIX_INSTRUCTIONS.md` (generic). Emitted per coder.
3. **Contract-bound prompt packs** — one per coder, scoped to "this batch only," with allowed files,
   hard constraints, and acceptance commands.
4. **The bundle fetch URL** — a single source of truth the agent (or a human) can pull.
5. **The validation gate** — `mb check` locally and `POST /v1/.../executions` server-side. This is
   the **single authority**: identical engine, identical verdict (`approved`/`needs-repair`/
   `rejected`), regardless of which coder produced the change.

The key architectural insight: **we do not need write-access into each tool.** The agent does its
normal job inside an allow-listed working tree; Matrix is the *bracket* around it — the contract on
the way in and the validator on the way out. That makes integration cheap and universal.

### 1.2 Per-tool task-execution model → Matrix integration

| Tool | How it executes tasks | Matrix integration | Depth |
|---|---|---|---|
| **Claude Code** | Agentic terminal coder; reads `CLAUDE.md` for project rules; plans then acts with file-edit/bash tools, iterating task by task. | Emit `CLAUDE.md` (rules = forbidden files, allowed roots, acceptance commands) + the batch prompt. Claude Code edits only allowed files; `mb check`/the API validates and feeds back the repair prompt. | **Strong** (helper auto-read) |
| **Codex (OpenAI)** | Cloud/CLI coding agent; reads `AGENTS.md`; takes a task spec, works in a sandbox/PR. | Emit `AGENTS.md` + the `codex-chatgpt` prompt pack + bundle URL; handoff mode = *paste/attach*. PR output is validated by Matrix before merge. | **Strong** |
| **Cursor** | AI IDE; Composer/agent mode; reads `AGENTS.md` / project rules; edits across the repo with human-in-the-loop. | Open the generated workspace; ship `AGENTS.md` + the `cursor` prompt for Composer. Validation runs on save/pre-commit via `mb check`. | **Strong** |
| **BOB — IBM watsonx Code Assistant** | Enterprise, governed assistant; work-item driven; emphasis on compliance and auditability. | Hand Matrix bundles as **governed work items** carrying validation evidence + signed standards lock; the `ibm-bob` prompt; results published to a private MatrixHub with attestation. Enterprise channel. | **Governed** |
| **GitPilot (native)** | Ruslan's own multi-agent coder: **Explorer → Planner → Coder → Reviewer**. | **Reference Matrix-native integration**: GitPilot ingests the bundle URL directly; Planner reads `MATRIX_TASKS.md`, Coder respects `MATRIX_ALLOWED_CHANGES.md`, Reviewer runs the Matrix validator. The showcase of "fully controlled, end-to-end." | **Native (deepest)** |

### 1.3 The strategic upgrade: an **MCP server** for Matrix

Today integration is via files + prompts (pull). The next leap is **Matrix-as-MCP**: expose the
engine over the Model Context Protocol so any MCP-capable agent (Claude Code, Cursor, and a growing
list) can call Matrix as **first-class tools**:

- `matrix.plan_batch(goal, change_type)` → the next scoped batch.
- `matrix.prompt(coder)` → the contract-bound prompt + helpers.
- `matrix.check(changed_files | patch)` → `approved | needs-repair | rejected` + findings.
- `matrix.repair()` → a bounded repair prompt.
- `matrix.commit()` / `matrix.publish()` → checkpoint / push to MatrixHub.

This turns "give AI coders a contract" into a **live control loop the agent calls itself**: it plans
a batch, implements, asks Matrix to validate, and self-repairs until `approved` — never leaving the
contract. The deterministic engine + `mb` already implement this loop; MCP just exposes it natively.
*(This is the single highest-leverage integration investment and should be a P1 feature.)*

### 1.4 Why this is defensible

- **Neutrality:** we integrate with *every* coder rather than betting on one — the standard outlives
  any single tool's UX.
- **The validator is the moat:** anyone can prompt an LLM; few can say *"this change is provably
  inside the contract and the standards lock,"* signed and reproducible.
- **GitPilot as proof:** a first-party Matrix-native coder demonstrates the ceiling and de-risks
  third-party adoption.

---

## Phase 2 — Worldwide go-to-market: become the category leader

### 2.1 Positioning & narrative
Own the phrase and the category: **"Give AI coders a contract, not a prompt."** Every team shipping
AI-written code hits the control/governance wall; we are the answer. The narrative ladder:
*prompt → contract → validated commit → signed, published bundle.*

### 2.2 The three growth flywheels
1. **Open standard (trust):** publish the **Matrix Standard** (matrix-definitions) as a versioned,
   signed, governed public spec with a conformance badge and examples on ruslanmv.com. Standards earn
   developer trust and pull in integrations.
2. **OSS + adapters as a Trojan horse (distribution):** `mb` is free, offline, deterministic, and
   works with *any* coder. Every AI-coder community (Claude Code, Codex, Cursor, IBM, GitPilot) is a
   distribution channel. "Works with the Matrix contract" becomes a recognizable mark.
3. **MatrixHub (network effects):** an open registry of trusted, signed, validated bundles —
   the "npm/Hugging Face for controlled AI builds." Reuse compounds adoption; it's free and OSS.

### 2.3 Distribution model — **purely open-source + sponsorship** (no billing)

> Direction (2026-06-13): the project is **100% open-source**; we do **not** sell tiers or meter
> usage. Sustainability comes from **GitHub Sponsors + grants** (Track FUND), not paywalls.

| Surface | Who | What they get | Cost |
|---|---|---|---|
| **`mb` CLI + engine** | every dev | full local/offline controlled-build loop | free, OSS |
| **The Matrix Standard + MatrixHub** | everyone | open spec, signed registry, public packs | free, OSS |
| **Hosted instance (HF Space)** | the community | a free hosted control plane (single simple Docker container) | free, sponsor-funded |

Per-user RLS isolates each user's data — a **correctness/privacy** property, not a paywall.
Anyone can self-host the same container. **Funnel:** `mb` adoption → hosted Space try → contributor
→ sponsor. Everything that would have been "Pro/Enterprise" stays free and open; enterprises are
served by **self-hosting** the OSS container and (optionally) sponsoring.

### 2.4 Channels & launch
- **Launch moment:** "We gave AI coders a contract" — essay + 90-sec demo (idea → validated commit) +
  Show HN / Reddit r/programming / X / LinkedIn, same day.
- **Content engine:** build-in-public threads, controlled-build case studies, "contract vs prompt"
  comparisons, a 10-minute `mb init`→published-bundle tutorial, the examples gallery.
- **Ecosystem PR:** one polished adapter + co-marketing per coder; "Matrix-native" badge for GitPilot.
- **Conferences:** PyCon, AI-engineering meetups, and the **IBM watsonx/TechXchange** ecosystem
  (leverages the existing watsonx Orchestrate generation target → enterprise credibility).

---

## Phase 3 — Community & Sponsorship: funding Ruslan Magana's work [critical]

The project's momentum is inseparable from its creator. Make **Ruslan Magana Vsevolodovna** the
recognized **author of the controlled-AI-builds category**, and convert that authority into
sustainable funding.

### 3.1 Personal brand → category authorship
- Publish the canonical essay **"The contract is the new prompt"** under Ruslan's name on
  ruslanmv.com, and author the Matrix Standard spec as *Ruslan Magana, ed.* — tie person ↔ standard.
- A consistent voice across X/LinkedIn/YouTube: weekly build-in-public, "controlled AI build of the
  week," and short demos. Speaker submissions to PyCon / IBM TechXchange / AI-eng confs.
- Unify the repos under **one brand, one site, one roadmap**, with ruslanmv.com as the front door to
  GitHub, docs, MatrixHub, and community.

### 3.2 GitHub Sponsors — concrete program
Enable **GitHub Sponsors** on `ruslanmv` and pin it across all repos (`FUNDING.yml`). Tiers:

| Tier | $/mo | Perks |
|---|---|---|
| **Supporter** | $5 | Name in SPONSORS.md; sponsor badge. |
| **Builder** | $25 | + private monthly "controlled-build" office hours digest; vote on roadmap. |
| **Pro backer** | $100 | + logo on ruslanmv.com & README; early access to MatrixHub features. |
| **Team sponsor** | $500 | + a monthly 1:1 advisory call; priority issue triage. |
| **Founding sponsor** | $2,500 | + logo on the spec, quarterly roadmap input, named in releases. |

Drivers: a clear **SUPPORT.md** ("why sponsor + what it funds"), a sponsor CTA in `mb` output and the
web footer, release notes thanking sponsors, and a public funding goal ("fund live MatrixHub +
maintenance"). Add **Open Collective** for orgs that prefer invoiced/transparent budgets.

### 3.3 Grants & seed funding (supply-chain-security angle is the unlock)
Matrix is *literally* AI supply-chain integrity (signed bundles, SBOMs, validated changes, provenance)
— exactly what these funders back:
- **Open-standard / OSS grants (primary):** Sovereign Tech Fund, NLnet/NGI Zero, Mozilla,
  GitHub Secure Open Source Fund, OpenSSF / Alpha-Omega (supply-chain security).
- **Recurring sponsorship:** GitHub Sponsors (individuals) + corporate sponsors / Open Collective.
- **Cloud credits:** Aiven/DigitalOcean/AWS Activate, GitHub for Startups — extend runway cheaply.

> The project stays **purely open-source + sponsorship-funded** — no paid tiers, no equity raise
> required. Grants and sponsors fund Ruslan's maintenance and the free hosted Space.

### 3.4 Community mechanics
- Discord/Matrix server; public roadmap; `good first issue` funnel; "Matrix Contributor" recognition.
- The GOVERNANCE.md / CONTRIBUTING.md / SECURITY.md already present read as a *serious* project —
  surface them prominently; they're a credibility and grant-readiness asset.

---

## Phase 4 — Execution roadmap (an AI-coder plan, in Matrix batches)

Delivered the way the product itself works: scoped **batches** an AI coder (`mb` + Claude Code/GitPilot)
executes under contract. Each: goal · allowed scope · acceptance.

### P0 — Secure & go live (this week)
- **OPS-01 Rotate & least-privilege.** Goal: rotate `avnadmin`; create `matrix_app`; app uses it.
  Allowed: Aiven console + env/secret store. Accept: app connects as `matrix_app`; `avnadmin`
  migrate-only; no secret in git.
- **OPS-02 Live migration.** Goal: `make migrate` + `aiven_setup.sql` on `pg-3113274d`; run
  `scripts/smoke_workflow.py` against it. Accept: smoke prints `SMOKE OK`; 10 tables + RLS live.
- **SEC-01 JWT secret.** Goal: generate ≥32-byte `MB_JWT_SECRET`; store in secret manager. Accept:
  no `InsecureKeyLengthWarning`; tokens verify.
- **OPS-03 $5 plan bump.** Goal: prevent idle power-offs + storage headroom (1 GB → upgrade). Accept:
  no auto power-off; storage alarm < 80%.

### P1 — Close the loop for real users (2–4 weeks)
- **DEPLOY-01 TLS deploy.** API container + web build behind a domain + TLS (e.g., Fly/Render/DO App
  Platform). Accept: `https://api.…` healthy; web served via CDN.
- **CI-01 Repo CI.** GitHub Actions on every repo: install (uv) → test → lint → typecheck → secret
  scan → SBOM/sign on tag; branch protection. Accept: red blocks merge; green badges.
- **L2-01 `mb sync` + `mb login`.** Device-style self-issued JWT; push/pull `.mb/` ↔ `/v1`
  (upsert-by-id); merged timeline; conflict = the server's version-conflict guard. Accept: a local
  batch appears in the web timeline after `mb sync`, and vice versa.
- **STORE-01 Real object storage.** Point `ObjectStorage` at an S3-compatible bucket (key layout is
  already immutable). Accept: report/diff/log/thumbnail bytes persist off-DB (protects the 1 GB DB).
- **OBS-01 OTel + alerts.** Wire the OTel exporter; dashboards (latency, pool usage vs the 20-conn
  cap), error alerting, uptime. Accept: traces/metrics flowing; on-call alert on 5xx/DB saturation.

### P2 — Integrate & adopt (1 quarter) — OSS + sponsorship, no billing
- **HF-01/02 Hugging Face Space.** One simple Docker container (root `Dockerfile`, port 7860); a
  free, sponsor-funded hosted instance. **No** Kubernetes, read replicas, or billing.
- **MCP-01 Matrix MCP server.** Expose `plan_batch/prompt/check/repair/commit/publish` over MCP
  (§1.3). Accept: Claude Code/Cursor drive a full self-repair loop via MCP tools.
- **HUB-01 Live MatrixHub publish.** Signed-artifact publish beyond dry-run; verified publishers.
- **SCALE-01 (optional, only under real load)** Out-of-process worker pool + broker; transaction
  pooler to honor the 20-conn cap. Scale vertically (Aiven plan) first.
- **ADP-01 Coder adapters + badge.** First-class Claude Code / Codex / Cursor / BOB adapters;
  "Matrix-native" GitPilot showcase; per-coder co-marketing.

### Success metrics (12 months)
`mb` installs; hosted sign-ups → Pro conversion; published MatrixHub bundles; ≥1 external tool
adopting the standard; sponsor MRR + a grant or pre-seed closed; Ruslan established as the category's
author.

---

## Appendix A — Risks & mitigations
- **"Just a wrapper" perception** → lead with the *standard + validator + signing*, not the UI.
- **Coder vendors add native control** → be the neutral cross-tool standard + registry; partner.
- **Solo-maintainer bus factor** → open governance, contributors, sponsor/grant-funded help.
- **1 GB / 20-conn Aiven limits** → object storage offload, small pool + pooler, $5 bump, plan-up at
  traction; backups already on (do-sfo2).
- **Secret hygiene** → rotate the exposed password; secret manager; CI secret scanning; signed
  releases. Never ship a demo-grade secret to production.

## Appendix B — Operator quickstart (no secrets in repo)
```bash
# 1) rotate avnadmin in the Aiven console, then:
export MIGRATION_DATABASE_URL="postgresql+psycopg://avnadmin:<NEW_PW>@pg-3113274d-matrix-builder.a.aivencloud.com:23188/defaultdb?sslmode=require"
export DATABASE_URL="postgresql+psycopg://matrix_app:<APP_PW>@pg-3113274d-matrix-builder.a.aivencloud.com:23188/defaultdb?sslmode=require"
export MB_JWT_SECRET="$(python -c 'import secrets;print(secrets.token_urlsafe(48))')"
make install            # uv
make migrate            # alembic upgrade head as avnadmin
psql "$MIGRATION_DATABASE_URL" -f services/api/scripts/aiven_setup.sql
psql "$MIGRATION_DATABASE_URL" -c "ALTER ROLE matrix_app PASSWORD '<APP_PW>'"
cd services/api && APP_DATABASE_URL="$DATABASE_URL" python scripts/smoke_workflow.py   # expect SMOKE OK
```
