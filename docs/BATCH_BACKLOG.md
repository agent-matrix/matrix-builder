# Matrix — Complete Batch & Action Backlog

Author: AI Systems Architect review · Date: 2026-06-13 · Owner: Ruslan Magana Vsevolodovna
Companion to `docs/PROJECT_STATUS_AND_STRATEGY.md`. This is the **authoritative, exhaustive list
of batches and actions** to take the Matrix ecosystem from "works end-to-end" to a production-grade,
worldwide platform. Batches follow the project's own idiom (scoped goal · repos · allowed scope ·
actions · acceptance · deps), the same contract `mb`/an AI coder executes.

Status legend: ✅ done · 🔜 next · ⬜ todo. Priority: **P0** secure&live · **P1** close-the-loop ·
**P2** integrate/scale/monetize · **P3** category leadership.

---

## 0. Already shipped (baseline — do not redo)

| Batch | What | Status |
|---|---|---|
| C1 | Persistence: ORM, Alembic, forced owner RLS, JWT verify | ✅ |
| C2 | `/v1` workflow API (projects→versions→batches→commits→runs→repair) | ✅ |
| C3 | Append-only run events + WebSocket streaming + real execution worker | ✅ |
| C4 | Continue Build / Build Timeline / Validation Result pages + seeded thumbnails | ✅ |
| L1 | Local-first `mb` CLI (init/next/prompt/check/repair/timeline) | ✅ |
| INFRA-0 | Aiven switch (ADR 0002), uv `make install`, real `make migrate`, placeholders removed | ✅ |
| DOC-0 | Status & worldwide strategy report | ✅ |

Engine `agent-generator v1.1.0` (idea→blueprint→bundle→validate→repair→commit→publish) and
`matrix-definitions` pack `2026.06.0` underpin all of the above. **75 tests green; typecheck clean.**

---

## Phase P0 — Secure & go live (this week)

| Batch | Goal | Repos | Key actions | Acceptance | Deps |
|---|---|---|---|---|---|
| **OPS-01** ✅ | Rotate exposed `avnadmin` | Aiven | Rotated by owner | Old credential dead | — |
| **OPS-02** 🔜 | Least-privilege app role live | matrix-builder | Run `aiven_setup.sql`; create `matrix_app` (NOSUPERUSER NOBYPASSRLS); set its password in secret store | App connects as `matrix_app`; `avnadmin` migrate-only | OPS-01 |
| **OPS-03** 🔜 | Live schema on Aiven | matrix-builder | `MIGRATION_DATABASE_URL=… make migrate`; run `scripts/smoke_workflow.py` against Aiven | `SMOKE OK`; 10 tables + RLS live | OPS-02 |
| **SEC-01** 🔜 | Strong JWT secret | matrix-builder | `MB_JWT_SECRET=$(secrets.token_urlsafe 48)` into secret store; remove dev default in prod | No `InsecureKeyLengthWarning`; tokens verify | — |
| **OPS-04** ⬜ | $5 Aiven bump | Aiven | Upgrade plan (storage, Basic support, no idle power-off) | No auto power-off; storage alarm <80% | — |
| **SEC-02** ⬜ | `FUNDING.yml` + no-secret guard | all repos | Add `.github/FUNDING.yml` (sponsors: ruslanmv); confirm `check_no_secrets.py` in CI | Sponsor button on every repo; secret scan green | — |

---

## Phase P1 — Close the loop for real users (2–4 weeks)

### Track DEPLOY — hosting & TLS
- **DEPLOY-01** ⬜ Containerize API. Dockerfile for `services/api` (uvicorn+gunicorn workers); healthcheck `/health`; non-root; pinned base. *Accept:* `docker run` serves the API.
- **DEPLOY-02** ⬜ TLS + domain. Deploy API + web behind TLS (Fly/Render/DO App Platform or k8s+cert-manager). *Accept:* `https://api.matrixhub.io/health` 200; web on CDN; HSTS on.
- **DEPLOY-03** ⬜ Web production build. `next build` in CI; serve via CDN; wire `NEXT_PUBLIC_API_BASE_URL`. *Accept:* the three C4 pages load against prod API.
- **DEPLOY-04** ⬜ Staging environment. Separate Aiven DB/schema + secrets; deploy from `main`. *Accept:* staging mirrors prod, distinct creds.

### Track CI — pipelines & supply chain (every repo)
- **CI-01** ⬜ Test/lint/typecheck workflow. GitHub Actions: uv install → `make test` → `make lint` → frontend typecheck → secret scan. *Accept:* red blocks merge; status badges.
- **CI-02** ⬜ Branch protection. Require green + review on `main` across all 8 repos. *Accept:* no direct pushes to `main`.
- **CI-03** ⬜ Supply-chain release. On tag: build, SBOM (`generate_sbom.py`), checksums, **Sigstore/cosign sign**, GitHub Release. *Accept:* signed artifacts + SBOM attached.
- **CI-04** ⬜ Dependency hygiene. Dependabot/renovate + `pip-audit`/`npm audit` gate. *Accept:* weekly PRs; criticals block.

### Track SECR — secrets & config
- **SECR-01** ⬜ Secret manager. Load `DATABASE_URL`/`MB_JWT_SECRET`/keys from Vault/Doppler/cloud param store at runtime; never in files. *Accept:* app boots with zero secrets on disk.
- **SECR-02** ⬜ Per-env config. Distinct dev/staging/prod keys; documented. *Accept:* env matrix in `docs/`.

### Track L — `mb` sync (the pending CLI batch)
- **L2-01** 🔜 `mb login`. Device-style self-issued HS256 JWT via `MB_JWT_SECRET` (or `--token`); store in `.mb/credentials`. *Accept:* `mb login` yields a token the API accepts.
- **L2-02** 🔜 Server upsert-by-id. `/v1` accepts client-provided ids (PUT/upsert) so `.mb/` ↔ tables share shapes. *Accept:* re-pushing is idempotent.
- **L2-03** 🔜 `mb sync`. Push local batches/commits/validations; pull server state; conflict = the server's version-conflict guard. *Accept:* a local batch appears in the web Build Timeline after `mb sync`, and vice versa.
- **L2-04** ⬜ Merged timeline + `mb check --watch`. `mb timeline` merges local+server; `--watch` tails the run-event stream. *Accept:* live run events stream in the terminal.

### Track DATA — object storage
- **DATA-01** ⬜ S3-compatible backend. Implement the S3 path in `ObjectStorage` (boto3/minio); keep the immutable key layout. *Accept:* report/diff/log/thumbnail bytes persist off-DB.
- **DATA-02** ⬜ Signed URLs. Serve artifacts/thumbnails via short-lived signed URLs (frees the API and the 1 GB DB). *Accept:* web loads thumbnails from storage, not the DB.

### Track OBS — observability
- **OBS-01** ⬜ OTel export. Wire the OTel exporter (traces+metrics) to a collector (Grafana Cloud/Tempo/Prometheus). *Accept:* end-to-end trace of a build loop.
- **OBS-02** ⬜ Dashboards + alerts. Pool usage vs the 20-conn cap, 5xx rate, run latency, WS connections; alert to Slack/email. *Accept:* alert fires on DB saturation/5xx.
- **OBS-03** ⬜ Central logging + SLOs. Structured logs to Loki/ELK; define uptime/latency SLOs. *Accept:* searchable logs; SLO doc.

---

## Phase P2 — Integrate & adopt (1 quarter) — OSS + sponsorship, no billing

### Track MCP — Matrix-as-MCP + coder adapters (the integration moat)
- **MCP-01** ⬜ Matrix MCP server. Expose `matrix.plan_batch / prompt / check / repair / commit / publish` over MCP (wraps the engine + `/v1`). *Accept:* an MCP client drives a full self-repair loop.
- **MCP-02** ⬜ Claude Code adapter. Polished `CLAUDE.md` + MCP registration + a "controlled mode" quickstart. *Accept:* Claude Code completes a batch and reaches `approved` via MCP.
- **MCP-03** ⬜ Codex adapter. `AGENTS.md` + prompt pack + PR-validation hook; sample GitHub Action. *Accept:* a Codex PR is validated by Matrix pre-merge.
- **MCP-04** ⬜ Cursor adapter. `AGENTS.md` + MCP server config + Composer recipe. *Accept:* Cursor agent mode uses Matrix tools.
- **MCP-05** ⬜ IBM BOB adapter. Matrix bundle → governed work item carrying signed lock + validation evidence; watsonx fit. *Accept:* a Bob run publishes attested evidence.
- **MCP-06** ⬜ GitPilot native. Bundle-URL ingestion; Planner reads `MATRIX_TASKS.md`, Reviewer runs the Matrix validator; audit trail back to MatrixHub. *Accept:* GitPilot completes a controlled build end-to-end (the flagship demo).
- **MCP-07** ⬜ Cloud-model connectors. MCP connectors for Vertex AI / Bedrock / Azure OpenAI as engine backends/targets. *Accept:* generate against ≥1 cloud model.

### Track STD — the Matrix Standard / "Matrix Pack"
- **STD-01** ⬜ Publish the spec. Versioned, signed public spec on ruslanmv.com + matrix-definitions; conformance test suite + badge. *Accept:* external doc + `2026.07.0` schema bump.
- **STD-02** ⬜ Matrix Pack manifest. Formalize the open task-manifest (JSON/YAML) every coder consumes; schema + validator + examples. *Accept:* a pack validates against the schema and runs across ≥2 coders.
- **STD-03** ⬜ Governance. GOVERNANCE/CONTRIBUTING refresh; RFC process; CODEOWNERS. *Accept:* an external PR merges via the process.

### Track HUB — MatrixHub registry
- **HUB-01** ⬜ Live publish. Signed-artifact publish beyond dry-run; verified publishers; provenance. *Accept:* a bundle is published and re-fetched with verified signature.
- **HUB-02** ⬜ Discovery + versioning. Search/browse, semver, deprecations. *Accept:* find+install a published pack by name.
- **HUB-03** ⬜ Skills Marketplace. Community Matrix Packs with ratings/usage; submission flow. *Accept:* a third party publishes a pack.

### Track DEPLOY-HF — simple Docker on Hugging Face (current direction)
- **HF-01** ✅ HF Spaces container. Root `Dockerfile` (port 7860, uv, `requirements.txt`) + `docs/deploy-huggingface.md`. *Accept:* `/health` 200 on the Space.
- **HF-02** ⬜ Go live on a Space. Create the Space, set secrets (`DATABASE_URL`=`matrix_app`, `MB_JWT_SECRET`), migrate Aiven once, verify. *Accept:* public Space serving the API.

### Track SCALE — concurrency (kept simple; NO k8s / replicas for now)
- **SCALE-01** ⬜ *(optional, only under real load)* Broker + out-of-process worker pool. Redis/NATS queue; the in-process `RunWorker` becomes a pool; transaction pooler to honor the 20-conn cap. *Accept:* N concurrent validations without DB saturation.
- ~~SCALE-02 read replicas~~ · ~~SCALE-03 Kubernetes/Helm/HPA~~ — **deferred by direction.** One always-on HF container is enough for launch; scale **vertically** (Aiven plan) before adding any node/replica complexity.

### Funding model — OSS + sponsorship ONLY (no billing)
The project is **purely open-source**; sustainability comes from **GitHub Sponsors + grants**, not
paywalls. There is **no BIZ/billing/quotas/orgs-monetization track.** Any hosted instance (e.g. the
HF Space) is a free community service funded by sponsors — see Track FUND in P3. Per-user RLS still
isolates data; that's a correctness/privacy property, not a paywall.

---

## Phase P3 — Category leadership (ongoing)

### Track GTM — go-to-market & content
- **GTM-01** ⬜ Launch. Essay "The contract is the new prompt" + 90-sec demo + Show HN/Reddit/X/LinkedIn, same day. *Accept:* launch live; metrics tracked.
- **GTM-02** ⬜ Docs site + tutorial. 10-minute `mb init`→published-bundle; examples gallery. *Accept:* tutorial reproducible by a new user.
- **GTM-03** ⬜ Per-coder co-marketing. One adapter launch post each (Claude Code/Codex/Cursor/BOB/GitPilot). *Accept:* ≥1 vendor cross-post.
- **GTM-04** ⬜ Conferences/podcasts. Submit to PyCon / GitHub Universe / IBM TechXchange / KubeCon; Ruslan podcast tour. *Accept:* ≥1 accepted talk.

### Track FUND — sponsorship & funding (promote Ruslan Magana)
- **FUND-01** ⬜ GitHub Sponsors live. Tiers $5/$25/$100/$500/$2,500; `SUPPORT.md`; sponsor CTA in `mb` output + web footer + every README. *Accept:* Sponsors page live, linked everywhere.
- **FUND-02** ⬜ Open Collective. Org-friendly transparent budget for corporate sponsors. *Accept:* collective live.
- **FUND-03** ⬜ Grants. Apply: GitHub Secure Open Source Fund, Sovereign Tech Fund, NLnet/NGI, OpenSSF/Alpha-Omega — pitch = AI supply-chain integrity. *Accept:* ≥2 applications submitted.
- **FUND-04** ⬜ Seed/credits. Dev-tools pre-seed deck; AWS Activate / GitHub for Startups credits. *Accept:* deck + credits applied.
- **FUND-05** ⬜ Ruslan brand. Bio/story on sites + MatrixHub; "created by Ruslan Magana Vsevolodovna" + sponsor CTA on talks/blogs/releases. *Accept:* consistent attribution + funnel to Sponsors.

### Track COMM — community
- **COMM-01** ⬜ Discord/Matrix server + public roadmap + `good first issue` funnel. *Accept:* active channels, first external contributor.
- **COMM-02** ⬜ Office hours + contributor recognition (release-note credits, "Matrix Contributor"). *Accept:* recurring cadence.
- **COMM-03** ⬜ Hackathon/workshop ("AI DevOps" / best Matrix Pack). *Accept:* event run, submissions in.

### Track COMP — privacy & compliance
- **COMP-01** ⬜ Trust center. Public security/privacy page; data-handling + RLS explainer. *Accept:* page live.
- **COMP-02** ⬜ Audit log + retention; RBAC beyond RLS. *Accept:* tamper-evident audit trail.
- **COMP-03** ⬜ SOC2 Type II / ISO 27001 readiness. Controls inventory; partner program. *Accept:* readiness assessment passed.
- **COMP-04** ⬜ Backups/DR runbook. Aiven backups (do-sfo2) + restore drill. *Accept:* documented restore test.

---

## Critical path (do in this order)
`OPS-02 → OPS-03 → SEC-01` (live & secure) → `CI-01 → DEPLOY-02` (shippable) → `L2-01..03`
(real users sync) → `DATA-01` (protect the 1 GB DB) → `OBS-01` (see it) → `MCP-01 + MCP-06`
(the integration moat, GitPilot flagship) → `HUB-01` (publish) → `FUND-01 + GTM-01` (fund & launch)
→ `FUND-01 + GTM-01` (fund via sponsorship & launch). Deployment is a single simple HF Spaces
container (HF-01/HF-02); `SCALE-01` only if real concurrency demands it. No billing — OSS +
sponsorship only.

## Suggested cadence
~2–4 week sprints, feature-flagged with canary releases. Each batch lands behind CI green and a
signed release where it ships an artifact. Track on a public project board so sponsors see progress.
