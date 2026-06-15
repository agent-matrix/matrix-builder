# AI Ownership Policy — Deterministic vs Internal AI vs External AI

This is the official policy for **where AI is allowed in Matrix Builder, and where it is not**.
It exists to answer one question precisely: *what is the least amount of AI we can offer, optionally,
without weakening what the program already does?*

The short answer:

```
Deterministic Matrix = architect + judge   (owns the contract; always runs)
Internal AI          = assistant / explainer / optimizer   (optional; never owns rules)
External AI coder    = worker / implementer   (out of our process; writes code only)
```

The one-line principle:

> **Matrix Builder does not ask AI to govern AI. It gives AI a contract, then verifies the work.**

---

## 0. What is true *today* (important)

Before the policy, the honest baseline. As of this writing the running system is **100%
deterministic** — there is no LLM anywhere in the request path.

- `AGENT_GENERATOR_MODE=mock` → the deterministic *dev* engine in `AgentGeneratorAdapter`.
- `AGENT_GENERATOR_MODE=sdk` → the real `agent_generator.engine.AgentGenerator`.

Both are rule-based. `parse_idea`, `generate_blueprint_candidates`, `compile_bundle`,
`generate_coder_prompt_pack`, and `validate_ai_coder_patch` produce the same output for the same
input, with no API key, no internet, and no cloud storage. `AGENT_GENERATOR_MODE` selects *which
deterministic engine* runs — **it is not an AI switch**.

So "Internal AI" below is a **new, additive, optional** layer. Turning it on must not change who
owns the contract. Turning it off must return the system to exactly today's behavior. That is the
whole point of the policy.

---

## 1. Ownership split

| Area | Owner | AI used? | Final authority |
| --- | --- | ---: | --- |
| Idea parsing | Deterministic engine (`parse_idea`), optionally helped by internal AI | Optional | Deterministic |
| 3 blueprint candidates | Deterministic engine (`generate_blueprint_candidates`) | Optional enrichment only | Deterministic |
| Starter / Standard / Production tiers | Deterministic engine | No | Deterministic |
| Matrix Bundle | Deterministic engine (`compile_bundle`) | No | Deterministic |
| `MATRIX_BLUEPRINT.yaml` | Deterministic engine | No | Deterministic |
| `MATRIX_STANDARDS.lock` | Deterministic engine + matrix-definitions | No | Deterministic |
| Allowed / forbidden files | Deterministic engine | No | Deterministic |
| Coder prompt | Deterministic engine (`generate_coder_prompt_pack`), optionally polished by internal AI | Optional | Deterministic |
| **Code writing** | **External AI coder** | **Yes** | External AI produces, Matrix checks |
| Validation | Deterministic validator (`validate_changes` / drift detector) | No | Deterministic |
| Repair prompt | Deterministic engine (`plan_repair_batch`), optionally explained by internal AI | Optional | Deterministic |
| Matrix Commit | Deterministic engine | No | Deterministic |

The rule:

```
AI can help language and implementation.
AI cannot own contracts, locks, validation, or approval.
```

---

## 2. Deterministic layer (the spine — always runs)

This is the core of Matrix Builder and the strongest part of the product. It is implemented in
`services/api/app/integrations/agent_generator_adapter.py` (and the real engine it delegates to).

It owns these operations:

```
parse_idea
generate_blueprint_candidates
generate_controlled_blueprint
compile_bundle            (compile_bundle_files → byte-for-byte == the CLI)
generate_coder_prompt_pack
validate_bundle
validate_changes / validate_patch
plan_batch / plan_repair_batch
create_matrix_commit
```

It produces these control artifacts:

```
MATRIX_BLUEPRINT.yaml
MATRIX_STANDARDS.lock
MATRIX_TASKS.md
MATRIX_ALLOWED_CHANGES.md
MATRIX_ACCEPTANCE_CRITERIA.md
MATRIX_VALIDATION.md
Matrix Commit
Validation Report
```

The control-file immutability and the change allowlist are enforced here, in code, not by any
model — see `_is_forbidden()` (control files + `MATRIX_*` prefix are always forbidden) and
`_within_allowlist()` in the adapter. A submission that touches a control file is `rejected` with
score 0 regardless of anything an AI says.

This layer must keep working with:

```
no OpenAI key   no Claude key   no OllaBridge
no internet     no cloud storage
```

---

## 3. Internal AI layer (optional; new; fail-open)

Internal AI is **our** AI, gated behind a flag and **off by default**. Its only job is to make the
product *feel* smarter. It must never become the source of truth.

Allowed uses:

```
better candidate descriptions / names
clearer onboarding and task wording
plain-language explanation of validation findings
plain-language repair explanation
risk summaries / developer-friendly docs
```

Example — the contract value stays deterministic, only the *display copy* is polished:

```
Deterministic engine produces:   "Standard FastAPI + Next.js repo analyzer"
Internal AI improves display to: "Production-ready GitHub repository intelligence agent
                                  with ingestion, analysis, and validation workflow."
```

Internal AI must **never**:

```
approve code
change standards or edit MATRIX_STANDARDS.lock
create the final allowed-files policy
override validator findings
silently add dependencies
silently change architecture
```

> **Internal AI is a product assistant, not the architect.**

**Fail-open contract:** if the internal AI service errors, times out, or is disabled, the UI shows
the deterministic text and the flow continues unchanged. No internal-AI failure can ever block a
build, a validation, or a commit.

---

## 4. External AI coder layer (out of our process)

This is the **user's** AI — Claude Code, Codex, ChatGPT, Cursor, GitPilot, IBM Bob, OllaBridge, a
local LLM, or a raw OpenAI/Claude API key. We do not manage it, host it, or pay for it.

Its only job:

```
write code for one batch
```

It receives (from the deterministic prompt pack):

```
task   allowed files   forbidden files
acceptance criteria   validation commands   Matrix Bundle context
```

It returns (pasted back by the user):

```
changed files   diff   test result   implementation summary
```

Then the deterministic validator checks it.

> **External AI coder is the worker, not the judge.**

---

## 5. End-to-end flow

```
User idea
  ↓  Deterministic engine creates 3 candidates
  ↓  (optional) Internal AI improves descriptions only
  ↓  User chooses a candidate
  ↓  Deterministic engine compiles the Matrix Bundle
  ↓  External AI coder writes code (outside us)
  ↓  User submits changed files / diff
  ↓  Deterministic validator checks the contract
  ↓
Approved      → Matrix Commit
Needs repair  → deterministic repair prompt (optionally explained by internal AI)
Rejected      → blocked (e.g. a control file was touched)
```

What this architecture buys: better UX from AI, safe contracts from deterministic logic,
model-agnostic code generation, low cost, offline / local-first support, strong validation.

---

## 6. Implementation shape

Three services, with strictly different authority:

### `MatrixEngineService` — authoritative (exists today)

```python
class MatrixEngineService:
    def parse_idea(self, idea): ...
    def generate_candidates(self, parsed_idea): ...
    def compile_bundle(self, candidate): ...
    def generate_prompt_pack(self, bundle): ...
    def validate_output(self, bundle, submitted_files): ...
    def create_commit(self, validation_report): ...
```

### `InternalAIService` — optional, fail-open (net-new)

```python
class InternalAIService:
    def enrich_candidate_copy(self, candidates): ...
    def explain_validation_findings(self, findings): ...
    def improve_repair_message(self, repair_prompt): ...
    # On any failure: return the deterministic input unchanged.
```

### `ExternalCoderService` — user-controlled (net-new, thin)

```python
class ExternalCoderService:
    def create_prompt(self, bundle, coder): ...        # deterministic prompt pack
    def run_with_ollabridge(self, prompt, provider): ...  # later, after pairing
    def parse_submission(self, output): ...            # parse pasted changed files
    # On any failure: fall back to copy-paste prompt.
```

---

## 7. Modes (`MATRIX_AI_MODE`) — orthogonal to `AGENT_GENERATOR_MODE`

`AGENT_GENERATOR_MODE` picks *which deterministic engine* (mock dev vs real engine).
`MATRIX_AI_MODE` picks *whether the optional internal AI layer is on*. They are independent.

### Mode A — `deterministic` (default; this is today's behavior)

```
Matrix creates candidates → bundle → prompt
User uses an external AI coder manually (copy-paste)
Matrix validates
```

No internal AI. No cloud storage. No managed coding. This is the MVP and the launch default.

### Mode B — `assisted` (premium UX, later)

```
Matrix creates candidates
Internal AI improves wording (display copy only)
Matrix still owns the bundle and validation
```

Feels smarter without losing control. Falls back to Mode A on any internal-AI failure.

### Mode C — `managed-coder` (later, after OllaBridge pairing)

```
Matrix creates the contract
OllaBridge runs the user-selected AI coder with the user's key
Matrix validates the output
```

Powerful, but not needed for launch.

---

## 8. Recommended default (given Phase 3 cloud storage deferred)

```
Default: deterministic
Optional: external AI coder via copy-paste prompt
Later:   OllaBridge device pairing (managed-coder)
Later:   internal AI assist mode
```

Launch surface:

```
mb CLI → deterministic candidates → Matrix Bundle → coder prompt
→ manual external AI coder → deterministic validation → Matrix Commit
```

That is enough to prove the product, at near-zero cost.

---

## 9. Fallback rules

```
Internal AI fails        → use deterministic candidate / repair text.
External AI coder fails   → show the prompt; user pastes it into any coder.
Output is invalid         → validator returns needs_repair or rejected.
Output touches a control  → reject immediately (enforced in _is_forbidden).
Output is good            → create Matrix Commit.
```

---

## 10. Ownership diagram

```
                    ┌─────────────────────────────┐
                    │      Matrix deterministic    │
User idea ─────────▶│      architect + judge       │
                    │ parse / candidates / bundle  │
                    └──────────────┬──────────────┘
                                   │ optional display improvement
                                   ▼
                    ┌─────────────────────────────┐
                    │        Internal AI           │
                    │ assistant / explainer        │
                    │ no authority over rules      │
                    └──────────────┬──────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │      Contract prompt         │
                    │ task + allowed files         │
                    └──────────────┬──────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │       External AI coder      │
                    │ Claude / Codex / GitPilot    │
                    │ writes code only             │
                    └──────────────┬──────────────┘
                                   ▼
                    ┌─────────────────────────────┐
                    │      Matrix validator        │
                    │ approved / repair / rejected │
                    └──────────────┬──────────────┘
                                   ▼
                            Matrix Commit
```

---

## 11. Official ownership (the policy)

```
Deterministic Matrix owns:  contracts, standards, allowed files, validation, commits, fallback
Internal AI owns:           explanation, enrichment, suggestion, summarization, repair wording
External AI coder owns:     implementation only, one batch at a time, inside allowed files
```

> Matrix Builder does not ask AI to govern AI.
> Matrix Builder gives AI a contract, then verifies the work.

---

## 12. Internal AI in practice: OllaBridge (optional, off by default)

The Internal AI layer is implemented as an **optional** OllaBridge connection, configured per-browser
in Account Settings → System Configuration. Provider defaults to `None`, so a fresh install makes
zero AI calls and behaves exactly like the deterministic baseline above.

When a user opts in (`provider: OllaBridge`, assisted mode on), Internal AI is wired into exactly two
display-only seams, both fail-open:

- **Candidate enrichment** — may rewrite `displayName / displaySummary / displayRationale` only. The
  deterministic candidate that drives bundle generation is never mutated; enriched cards are badged
  "AI-assisted wording". It can never change `id, tier, stack, files, tasks, allowed files,
  standards, bundle, prompt, validation`.
- **Validation explanation** — may add plain-language helper copy. The `status`, `score`, and
  `findings` always come from the deterministic validator.

Tokens and API keys stay in the browser (`localStorage["matrix-builder:ai-settings:v1"]`), are never
sent to the Matrix Builder backend, and are cleared on account deletion. Source code and bundle ZIPs
are never sent to OllaBridge. See [`ollabridge-internal-ai.md`](./ollabridge-internal-ai.md).

The policy in one sentence:

> **Internal AI can improve the words users see, but it cannot change the contract users build from.**
