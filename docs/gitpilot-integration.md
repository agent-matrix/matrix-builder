# GitPilot Integration

GitPilot by RuslanMV is a first-class AI-coder path for Matrix Builder.

The purpose is not to give GitPilot an unconstrained product idea. The purpose is to give GitPilot a **Matrix Bundle** and ask it to implement within the contract.

## User experience

On the Matrix Bundle result screen:

```text
[Send to GitPilot]
[Copy GitPilot prompt]
[Download ZIP]
```

The user should feel:

```text
Matrix Builder prepared the project contract.
GitPilot can now help implement it safely.
```

## GitPilot prompt behavior

GitPilot should be instructed to:

1. Fetch or read the Matrix Bundle.
2. Read `README.md` and all Matrix control files.
3. Use a planning step before implementation.
4. Implement only the active task.
5. Edit only allowed files.
6. Stop if a dependency, architecture, or forbidden-file change is required.
7. Run validation.
8. Produce a reviewer-style summary.

## Example opening

```text
You are GitPilot working inside a Matrix Builder controlled project.
AI coders are workers, not architects.

Fetch this Matrix Bundle and read its README and Matrix control files first:
{bundle_url}

Implement TASK-001 only.
```

## MatrixHub publishing

A GitPilot-created result should not be published directly. It must pass Matrix Builder validation first:

```text
GitPilot implementation → Matrix Builder validation → approved → MatrixHub publish
```

---

## Implementation reference (Batches 1–12)

The integration above is implemented as a direct, server‑to‑server flow.

```text
Matrix Builder                          GitPilot
  bundle (signed contract)
  ── POST /bundles/{id}/gitpilot/runs ──▶  /api/v1/gitpilot/runs   (queued)
                                            run repair pipeline inside the contract
  ◀── GET /gitpilot/runs/{run_id} ───────  status, diff, logs, tests
  validate the diff (drift detector)
     approved / needs‑repair / rejected
     ├─ approved    ─▶  Create Matrix Commit  +  POST …/pr  (PR on GitHub)
     ├─ needs‑repair ─▶ POST …/{run_id}/repair  ─▶ new child run ─▶ re‑validate
     └─ rejected    ─▶  blocked
```

### API surface (Matrix Builder, `/api/v1`)

| Endpoint | Purpose |
|---|---|
| `POST /bundles/{id}/gitpilot/runs` | Start a cloud run. The bundle URL is signed server‑side; the A2A secret never reaches the browser. |
| `GET  /gitpilot/runs/{run_id}` | Result sync: `{status, summary, diff_url, logs_url, test_status, changed_files}`. A pass is **not** approval. |
| `GET  /gitpilot/runs/{run_id}/diff` · `/logs` | Proxied diff/logs (no secret client‑side). |
| `POST /bundles/{id}/gitpilot/runs/{run_id}/validate` | Matrix verdict + commit gate. |
| `POST /bundles/{id}/gitpilot/runs/{run_id}/repair` | Dispatch a repair; GitPilot re‑runs inside the same contract. |
| `POST /bundles/{id}/gitpilot/runs/{run_id}/pr` | Open a PR — **409 unless the run is Matrix‑approved**. |
| `GET  /gitpilot/runs` | Owner‑scoped run history (persisted; in‑memory fallback). |
| `GET  /gitpilot/metrics` | Owner‑scoped summary (runs, status, verdicts). |

Process‑wide Prometheus counters are at `/metrics`:
`matrix_builder_gitpilot_runs_created`,
`…_validations_{approved|needs_repair|rejected}`, `…_prs_opened`, `…_prs_blocked`,
`…_repairs`.

### Guardrails

- **Control files** (`MATRIX_STANDARDS.lock`, `MATRIX_BLUEPRINT.yaml`, …) are always
  forbidden — even if a caller lists them in `allowed_files`.
- **Short‑TTL signed URLs** (`GITPILOT_RUN_TTL_SECONDS`, default 600s).
- **A2A auth** required in production; the facade fails closed when the secret is unset.
- **No self‑approval / self‑PR**: the commit gate and the PR are derived purely from
  the Matrix verdict, never from GitPilot's own tests.

### Configuration

Matrix Builder backend: `GITPILOT_MODE` (`mock`|`live`), `GITPILOT_BASE_URL`,
`GITPILOT_A2A_SECRET`, `SIGNED_URL_ENFORCE` (prod), `DATABASE_URL` (durable history).
GitPilot Space: `GITPILOT_A2A_SHARED_SECRET` (matches the above),
`GITPILOT_A2A_REQUIRE_AUTH=true`, `GITPILOT_PROVIDER=ollabridge`,
`GITPILOT_DRAFT_PR_ENABLED=true`.

> The run registry inside GitPilot is in‑memory per worker. Run the Space with a
> single uvicorn worker, or back the registry with a shared store, so
> status/diff/logs are consistent under multiple workers.

### Reproduce the demo

```bash
BASE_URL=https://ruslanmv-matrix-builder.hf.space/api/builder/api/v1 \
  scripts/gitpilot_demo.sh
```

Creates a hello‑world bundle, runs it through GitPilot, polls the result,
validates it, opens a PR when approved, and prints the metrics summary.
