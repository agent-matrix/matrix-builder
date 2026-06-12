/* Matrix Builder — embedded data, bundle generation, coder prompts, real ZIP builder */
window.MATRIX = (function () {
  const API = "https://api.ruslanmv.com/v1/matrix-bundles";

  const IDEA_EXAMPLES = [
    "A GitHub repo intelligence agent",
    "A document Q&A assistant",
    "A developer portfolio reviewer",
    "A local trend scout for AI topics",
    "A meeting-notes summarizer agent"
  ];

  const CODERS = [
    { id: "claude", name: "Claude Code", url: "https://claude.ai/code", short: "Claude" },
    { id: "codex", name: "Codex / ChatGPT", url: "https://chatgpt.com/", short: "Codex" },
    { id: "cursor", name: "Cursor", url: "https://cursor.com/", short: "Cursor" },
    { id: "gitpilot", name: "GitPilot", url: "https://ruslanmv.com", short: "GitPilot" },
    { id: "bob", name: "IBM Bob", url: "https://ruslanmv.com", short: "IBM Bob" },
    { id: "generic", name: "Any AI coder", url: "", short: "Generic" }
  ];

  function slugify(s) {
    return (s || "matrix-agent").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "matrix-agent";
  }
  function genId() {
    return "mb_" + Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
  }

  /* three controlled blueprint candidates derived from any idea */
  function candidates(idea) {
    const slug = slugify(idea);
    return [
      {
        id: "minimal", tier: "Minimal", name: slug + "-lite",
        summary: "The smallest controlled scaffold — validate the idea fast.",
        stack: ["Python", "FastAPI"], files: 14, difficulty: "Easy", time: "a weekend",
        standards: ["PEP 8", "12-Factor", "Semantic API"]
      },
      {
        id: "standard", tier: "Standard", recommended: true, name: slug,
        summary: "Balanced architecture with tests, docs and CI — ready to ship.",
        stack: ["Python", "FastAPI", "React", "Docker"], files: 31, difficulty: "Medium", time: "~1 week",
        standards: ["PEP 8", "12-Factor", "OpenAPI", "OWASP ASVS", "CI/CD"]
      },
      {
        id: "production", tier: "Production", name: slug + "-pro",
        summary: "Hardened, observable and scalable for real users.",
        stack: ["Python", "FastAPI", "React", "Docker", "K8s", "Postgres"], files: 58, difficulty: "Hard", time: "~3 weeks",
        standards: ["PEP 8", "12-Factor", "OpenAPI", "OWASP ASVS", "CI/CD", "OpenTelemetry", "SLSA"]
      }
    ];
  }

  function bundleUrl(id) { return API + "/" + id; }

  /* coder-specific prompt — the "contract, not a prompt" */
  function coderPrompt(coderId, idea, cand, id) {
    const coder = CODERS.find(c => c.id === coderId) || CODERS[5];
    const url = bundleUrl(id);
    return `You are not the architect. You are the implementation worker${coder.id !== "generic" ? " (" + coder.name + ")" : ""}.

Fetch this Matrix Bundle:
${url}

Read, in order:
- README.md
- MATRIX_BLUEPRINT.yaml
- MATRIX_STANDARDS.lock
- MATRIX_TASKS.md
- MATRIX_ALLOWED_CHANGES.md
- MATRIX_ACCEPTANCE_CRITERIA.md
- MATRIX_VALIDATION.md

Project: ${idea}
Blueprint: ${cand.name} (${cand.tier})

Rules:
- Implement only Task 01.
- Do not change the architecture.
- Do not add unapproved dependencies.
- Do not modify the MATRIX_* control files.
- Run MATRIX_VALIDATION before you finish.`;
  }

  /* the files that make up the Matrix Bundle */
  function bundleFiles(idea, cand, id) {
    const url = bundleUrl(id);
    const f = [];
    f.push({ name: "README.md", content:
`# Matrix Bundle — ${cand.name}

> A controlled build contract, not a vague prompt.

Idea: ${idea}
Blueprint: ${cand.tier}
Bundle: ${id}
Stack: ${cand.stack.join(", ")}

## How to build
1. Read MATRIX_BLUEPRINT.yaml
2. Follow MATRIX_TASKS.md, one task at a time
3. Stay inside MATRIX_ALLOWED_CHANGES.md
4. Pass MATRIX_ACCEPTANCE_CRITERIA.md
5. Run MATRIX_VALIDATION.md before finishing

Send to an AI coder with the prompts in coder-prompts/.
` });
    f.push({ name: "MATRIX_BLUEPRINT.yaml", content:
`apiVersion: matrix.builder/v1
kind: Blueprint
metadata:
  name: ${cand.name}
  tier: ${cand.tier.toLowerCase()}
  bundle: ${id}
idea: >
  ${idea}
stack:
${cand.stack.map(s => "  - " + s).join("\n")}
architecture:
  frontend: ${cand.stack.includes("React") ? "react" : "none"}
  backend: fastapi
  database: ${cand.stack.includes("Postgres") ? "postgres" : "sqlite"}
  deploy: ${cand.stack.includes("K8s") ? "kubernetes" : "docker"}
` });
    f.push({ name: "MATRIX_STANDARDS.lock", content:
`# Locked standards — do not edit
${cand.standards.map(s => "- " + s).join("\n")}
` });
    f.push({ name: "MATRIX_TASKS.md", content:
`# Tasks (implement one at a time)

## Task 01 — Project scaffold
Create the folder structure and entrypoints defined in MATRIX_BLUEPRINT.yaml.

## Task 02 — Core domain
Implement the core logic for: ${idea}.

## Task 03 — API surface
Expose the documented endpoints (OpenAPI).

## Task 04 — Tests & validation
Add tests and pass MATRIX_VALIDATION.md.
` });
    f.push({ name: "MATRIX_ALLOWED_CHANGES.md", content:
`# Allowed changes
- Files under src/, app/, tests/
- New routes that match the blueprint

# Forbidden
- Editing MATRIX_* control files
- New top-level dependencies not in MATRIX_STANDARDS.lock
- Changing the architecture
` });
    f.push({ name: "MATRIX_ACCEPTANCE_CRITERIA.md", content:
`# Acceptance criteria
- All tasks implemented and tested
- Lints clean against MATRIX_STANDARDS.lock
- API matches the documented contract
- No secrets committed
` });
    f.push({ name: "MATRIX_VALIDATION.md", content:
`# Validation
Run:
\`\`\`
make validate   # lint + tests + standards check
\`\`\`
The build is "approved" only when validation passes with no drift.
` });
    CODERS.forEach(c => {
      f.push({ name: "coder-prompts/" + c.id + ".md", content: coderPrompt(c.id, idea, cand, id) });
    });
    return f;
  }

  /* ---------- minimal store-method ZIP writer (real, no deps) ---------- */
  const MZIP = (function () {
    let table;
    function makeTable() { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; }
    function crc32(b) { if (!table) table = makeTable(); let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = (c >>> 8) ^ table[(c ^ b[i]) & 0xFF]; return (c ^ 0xFFFFFFFF) >>> 0; }
    const sb = s => new TextEncoder().encode(s);
    const u16 = v => [v & 0xFF, (v >> 8) & 0xFF];
    const u32 = v => [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF];
    function makeZip(files) {
      const enc = files.map(f => { const name = sb(f.name), data = sb(f.content); return { name, data, crc: crc32(data) }; });
      const parts = []; const central = []; let offset = 0;
      enc.forEach(f => {
        const h = new Uint8Array([].concat([0x50, 0x4b, 0x03, 0x04], u16(20), u16(0), u16(0), u16(0), u16(0), u32(f.crc), u32(f.data.length), u32(f.data.length), u16(f.name.length), u16(0)));
        parts.push(h, f.name, f.data); central.push({ f, offset }); offset += h.length + f.name.length + f.data.length;
      });
      const cdStart = offset; const cd = []; let cdSize = 0;
      central.forEach(({ f, offset }) => {
        const r = new Uint8Array([].concat([0x50, 0x4b, 0x01, 0x02], u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(f.crc), u32(f.data.length), u32(f.data.length), u16(f.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)));
        cd.push(r, f.name); cdSize += r.length + f.name.length;
      });
      const end = new Uint8Array([].concat([0x50, 0x4b, 0x05, 0x06], u16(0), u16(0), u16(enc.length), u16(enc.length), u32(cdSize), u32(cdStart), u16(0)));
      return new Blob([...parts, ...cd, end], { type: "application/zip" });
    }
    return { makeZip };
  })();

  return { IDEA_EXAMPLES, CODERS, candidates, bundleFiles, coderPrompt, bundleUrl, genId, slugify, MZIP };
})();
