# Multi-source blueprints — Docling + three input paths

**Status:** design. Non-destructive: every path funnels into the *existing* deterministic engine
(or skips straight to compile); nothing here changes who owns the contract.

> Bring an idea, a picture, a brief, a design, or a complete Blueprint JSON.
> Matrix Builder turns the input into a controlled build contract.

One composer, one Generate button, one secondary upload — but **three source types**, auto-detected:

| Source | What Matrix Builder does | AI involved? |
| --- | --- | --- |
| **Idea / picture** | *Designs* three controlled build paths from the input | Deterministic engine; OllaBridge optionally improves understanding/copy |
| **Brief — PDF / DOCX** | *Extracts & structures* the existing direction, then designs three paths | pypdf / python-docx → markdown; deterministic engine builds; OllaBridge optionally enriches the brief |
| **Complete Blueprint JSON** | **Skips AI.** Validates the JSON, imports it as the source of truth, compiles it | None — pure validation + compile |

The final output is always the same controlled Matrix workflow: locked standards, allowed changes,
coder prompts, validation rules.

---

## 1. Architecture (non-destructive)

```
        ┌─────────────────────────── composer (one input + Attach) ───────────────────────────┐
        │  text idea           file: pdf/docx/md/txt/png/jpg            file: *.blueprint.json  │
        └──────┬───────────────────────────┬──────────────────────────────────────┬───────────┘
               │ Path A                     │ Path B                                │ Path C
               ▼                            ▼                                       ▼
        (idea string)            Docling → Markdown → extract/summarize     validate BlueprintResult
               │                            │                                (StrictModel + rules)
               │                            ▼                                       │ valid?
               │                     ┌─ ProjectBrief (strict) ─┐                    │  yes → SKIP AI
               │   optional OllaBridge enhancer (logged-in, fail-open)              │
               └──────────────┬─────────────┘                                       │
                              ▼                                                      ▼
                 DETERMINISTIC engine: parse_idea → generate_candidates    engine.generate_matrix_bundle(blueprint)
                              │  (3 tiers: Minimal/Standard/Production)              │  + compile_bundle_files
                              └──────────────────────────┬─────────────────────────┘
                                                         ▼
                                   Matrix Bundle → coder prompt → validate → commit
```

**Invariant:** OllaBridge (and Docling) only help *understand the input*. The deterministic engine
still produces every contract; for Path C even the engine's generative steps are skipped — only
validation + compile run. `MATRIX_STANDARDS.lock` is always produced by Matrix from
matrix-definitions, never by the user or by AI.

---

## 2. The unifying object: `ProjectBrief`

Every non-JSON input becomes a `ProjectBrief` (a richer superset of today's `IdeaRequest`). New
StrictModel in `services/api/app/schemas/brief.py`:

```python
class ProjectBrief(StrictModel):
    schema_version: str = "matrix.builder.brief/v1"
    source_type: Literal["idea", "image", "document", "design"] = "idea"
    title: str
    summary: str
    domain: str | None = None              # inferred (consulting/healthcare/finance/…), never asked
    goals: list[str] = Field(default_factory=list)
    users: list[str] = Field(default_factory=list)
    features: list[str] = Field(default_factory=list)
    screens: list[str] = Field(default_factory=list)
    integrations: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    non_functional: list[str] = Field(default_factory=list)
    # provenance (for the "Project understood" card + audit)
    source_files: list[str] = Field(default_factory=list)
    enhanced_by: Literal["deterministic", "ollabridge"] = "deterministic"
```

**Brief → engine:** the brief is *folded back into the existing `IdeaRequest`* so the deterministic
engine is unchanged:
- `idea` = `f"{title}. {summary}"` + top features (a richer idea string → better keyword/template fit)
- `constraints` (preferred/forbidden stack, auth, data sensitivity) ← brief.constraints/non_functional
- `quality_level` stays user/engine-chosen.

So a fuller brief simply makes the engine's **existing** template match and quality recommendation
*more fitted* — with zero new AI authority. The brief is surfaced to the user as a small
collapsible **"Project understood"** card; it is never an editable form.

---

## 3. Path A — Idea / picture → *design*

Unchanged from today for text. For a **picture/screenshot** (design): Docling OCR extracts any text;
for logged-in OllaBridge users, a vision-capable model returns a short design description. Result →
`ProjectBrief(source_type="design")` → engine. Card sub-copy adapts:

```
Minimal     Build the core screens.
Standard    Build screens + backend + data flow.
Production  Full app + auth + tests + deployment + docs.
```

Fallback with no AI: filename + OCR text + "Design detected — we'll generate build plans from your
design instead of inventing a new idea."

---

## 4. Path B — Brief / PDF / DOCX → *extract & structure* (lightweight)

Accepted formats are **PDF and DOCX only** (keeps the scope and footprint small).

1. **Extract** the upload to Markdown with **pypdf** (PDF) and **python-docx** (DOCX) — pure-Python,
   no ML/torch, runs in-process on cpu-basic. Other formats are rejected with a clear message.
2. **Extract** a `ProjectBrief` from the markdown:
   - **Deterministic (always):** section/keyword heuristics over the markdown — goals, features,
     constraints, timeline hints, plus the engine's existing keyword→domain template scoring.
   - **OllaBridge (logged-in, opt-in, fail-open):** read the markdown → return a *better*
     structured `ProjectBrief` (domain, goals, features, NFRs). Strictly understanding-only; if it
     errors/times out, we keep the deterministic brief.
3. Feed the brief to the engine → same three cards, now fitted. Card sub-copy:

```
Minimal     Proof of concept from the brief.
Standard    Client-ready controlled implementation of the uploaded plan.
Production  Enterprise delivery: validation, tests, security, deployment, release evidence.
```

This is the enterprise/consulting lift: drop a client proposal / scope-of-work PDF → controlled
build plan, without inventing the product.

---

## 5. Path C — Complete Blueprint JSON → *skip AI, validate & follow*

The direct, AI-free path. The engine already supports the mechanics
(`BlueprintResult.model_validate(...)` and `compile_bundle(blueprint)` /
`generate_matrix_bundle(blueprint)`), so this is mostly wiring + a strict gate.

**Contract:** the user JSON must conform to `BlueprintResult`
(`services/api/app/schemas/blueprint.py`):

```
blueprint_id, candidate_id, name, slug, idea, quality_level,
stack{frontend, backend, worker?, database?, auth, deploy},
pages[], services[], api_routes[], required_files[],
allowed_change_roots[], forbidden_changes[],
tasks[{task_id: TASK-000, title, allowed_files[], acceptance_criteria[]}],
acceptance_commands[], standards_lock_ref
```

**Flow:**
1. Detect: an uploaded `.json` that validates against `BlueprintResult` (StrictModel forbids extras
   → tight schema check).
2. **Validate the rules** (not just the schema): `forbidden_changes` must include the Matrix control
   files; `allowed_change_roots` sane; `tasks` non-empty and task ids well-formed. Re-derive
   `MATRIX_STANDARDS.lock` from matrix-definitions (the *standards* are always Matrix's, even here).
3. **Skip** `parse_idea` and `generate_candidates` entirely. Go straight to
   `generate_matrix_bundle(blueprint)` + `compile_bundle_files(blueprint)` → Matrix Bundle.
4. UI: **"Blueprint JSON detected. AI skipped. Matrix Builder will validate and follow your
   blueprint."** → **Validate blueprint** → **Continue to Matrix Bundle**.

**Enterprise positioning (important):** *"Upload Blueprint JSON to **skip AI** and use your existing
specifications"* — never *"so AI can generate your blueprint."* The user owns *what* to build (the
blueprint); Matrix owns the *contract* (locked standards + validation). We ship a published JSON
Schema + a `mb blueprint export` example so clients can author conformant blueprints.

---

## 6. Document extraction — lightweight, in-process (Docling dropped)

Docling was evaluated and **rejected for now**: it pulls torch + OCR/layout models (multi-GB), too
heavy for the cpu-basic Space. Instead, extract text with two tiny pure-Python libraries that run
**in-process** (no sidecar, no models):

| Format | Library | Footprint |
| --- | --- | --- |
| PDF | `pypdf` (6.x) | pure Python, **zero required deps** |
| DOCX | `python-docx` (1.x) | only `lxml` + `typing_extensions` |

`document_extractor.extract_markdown(filename, data)` dispatches by extension/MIME:
PDF → `pypdf` page text; DOCX → `python-docx` paragraphs + tables → lightweight Markdown (headings
from styles, tables as pipe tables). Anything else → a clear "unsupported format" error. No OCR, so
**scanned/image-only PDFs yield little text** — acceptable for v1 (most consulting briefs are text).
Image formats are **not** accepted in this version. If richer parsing (OCR, layout, tables) is ever
needed, a Docling sidecar Space can be added later behind the same `/ingest/document` endpoint
without changing callers.

---

## 7. Backend API

New/extended endpoints (all owner-scoped where relevant; reuse the existing service + adapters):

```
POST /api/v1/ingest/document        # multipart upload → pypdf/python-docx → markdown → ProjectBrief
    body: file (PDF or DOCX only)
    → { source_type: "document", markdown, brief: ProjectBrief }

POST /api/v1/ingest/blueprint       # Path C — validate a user Blueprint JSON
    body: { blueprint: <json> }
    → { valid: bool, errors: [...], normalized: BlueprintResult }   # 422 with field errors if invalid

POST /api/v1/blueprints/candidates  # EXTENDED — accept an optional brief
    body: { idea? , brief?: ProjectBrief }
    → { candidates: [...] }          # brief folded into IdeaRequest as in §2

POST /api/v1/bundles                 # EXTENDED — accept an imported blueprint (Path C)
    body: { idea_request? , candidate_id? , blueprint?: BlueprintResult , preferred_coder }
    → MatrixBundle                   # when blueprint present: skip generation, compile it
```

`generate_bundle` (`matrix_builder_service.py`) gains one branch: if `payload.blueprint` is set,
**skip** `generate_controlled_blueprint` and call `generate_matrix_bundle(blueprint)` +
`compile_bundle_files(blueprint)` directly. Everything downstream (store, prompt with signed URL,
validation) is unchanged.

The OllaBridge brief-enhancer is a new method on `ai-provider-manager` (`enhanceProjectBrief`),
mirroring the existing `enrichBlueprintCandidates`: logged-in + assisted only, strict output schema,
fail-open to the deterministic brief.

---

## 8. Frontend (Apple-minimal — no modes, no wizard)

The composer stays one line; we add **one** secondary action and an auto-detecting upload modal.

```
Describe what you want to build…                          ← placeholder
Start with an idea, a brief (PDF/DOCX), or a Blueprint JSON.   ← helper

[ + Attach ]  [ Generate blueprint ]
Already have a brief or a Blueprint JSON? Upload it instead.   ← secondary link
```

**Upload modal** (reuses the portal + `auth-scrim` pattern):
- Title: *Upload your brief or Blueprint JSON*
- Subtitle: *Import an existing project direction (PDF/DOCX) or provide a complete Blueprint JSON.*
- Dropzone: *Drop a file or browse — PDF, DOCX, or Blueprint JSON*

**Auto-detection (no mode selector):** on file select,
- valid Blueprint JSON → *"Blueprint JSON detected. AI skipped. Matrix Builder will validate and
  follow your blueprint."* → **Validate blueprint** → **Continue to Matrix Bundle**.
- PDF / DOCX → *"Project brief detected — we'll extract goals, features, constraints, and delivery
  requirements."*

Between input and the three cards, a small collapsible **"Project understood"** card shows the
inferred brief (title + one-line summary), with an "AI-assisted" badge when OllaBridge shaped it.
The three cards are the **same**; only their sub-copy adapts to the source (§3–5).

---

## 9. Guardrails & fallbacks (unchanged invariants)

- Deterministic engine remains the sole author of contracts (Paths A/B) or is skipped for compile
  only (Path C). OllaBridge/Docling never write `MATRIX_STANDARDS.lock`, never validate, never
  approve, never choose the final tier.
- **Always works:** no login → deterministic. No OllaBridge → deterministic brief. Docling off →
  native text read. Invalid Blueprint JSON → clear field errors, user fixes and re-validates.
- Attachments and the OllaBridge brief-enhancer are gated to logged-in users (and OllaBridge for the
  AI lift), exactly like the existing assist.

---

## 10. Phased plan (essential-first)

1. **P0 — Blueprint JSON import (no Docling, highest enterprise value, lowest risk).**
   `POST /ingest/blueprint` + the `blueprint` branch in `generate_bundle` + the upload modal's JSON
   detection. Publish the BlueprintResult JSON Schema + `mb blueprint export`. Ships the "skip AI,
   follow my spec" path immediately.
2. **P1 — Lightweight PDF/DOCX extraction (in-process).** `document_extractor` (pypdf +
   python-docx) + `POST /ingest/document` → markdown. No sidecar, no ML.
3. **P2 — ProjectBrief + composer attach.** `ProjectBrief` schema; deterministic brief from the
   markdown; brief→IdeaRequest fold; attach button + modal; "Project understood" card; adaptive
   card copy. Works with no AI.
4. **P3 — OllaBridge brief-enhancer.** `enhanceProjectBrief` (logged-in, fail-open) for better
   domain detection and structured briefs from the extracted text.

Each phase is independently shippable and reversible, and the product is fully functional after P0.
(Images/OCR and a Docling sidecar are deliberately out of scope for now.)
