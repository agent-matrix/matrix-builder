import type { Metadata } from "next";
import Link from "next/link";
import AuthControls from "../AuthControls";

const URL = "https://build.matrixhub.io/matrix-builder/about";

export const metadata: Metadata = {
  title: "About Matrix Builder — Controlled AI Builds for Developers",
  description:
    "Matrix Builder turns software ideas into controlled AI build contracts: blueprints, locked standards, coder prompts, tasks, and validation before you ship — for Claude Code, Codex, Cursor, GitPilot, and IBM Bob.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Matrix Builder — Give AI coders a contract, not a prompt",
    description:
      "Create controlled AI build bundles with blueprints, standards, tasks, prompts, and validation.",
    url: URL,
    siteName: "Matrix Builder",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Matrix Builder — Controlled AI Builds",
    description:
      "Turn an idea into a controlled build contract for Claude Code, Codex, GitPilot, and other AI coding agents.",
  },
};

const FAQ = [
  ["What is Matrix Builder?", "Matrix Builder turns a software idea into a controlled build contract — a Matrix Bundle — containing a blueprint, locked standards, tasks, ready-to-use coder prompts, and validation criteria, so AI coders build exactly what you intended."],
  ["How is it different from Claude Code or Codex alone?", "Those are excellent AI coders. Matrix Builder is the control layer around them: instead of a vague prompt, the coder receives a signed contract — an allowed-files scope, locked standards, and acceptance criteria — and the result is validated against it."],
  ["What is a Matrix Bundle?", "A signed package: MATRIX_BLUEPRINT.yaml, MATRIX_STANDARDS.lock, MATRIX_TASKS.md, MATRIX_ALLOWED_CHANGES.md, MATRIX_ACCEPTANCE_CRITERIA.md, MATRIX_VALIDATION.md, plus per-coder prompts and a checksummed manifest."],
  ["Which AI coders does it work with?", "Claude Code, Codex / ChatGPT, Cursor, GitPilot, IBM Bob, and any generic AI coder. It complements your tool — it doesn't replace it."],
  ["How does validation work?", "The same deterministic engine that generated the bundle checks the result against the contract and returns approved, needs-repair, or rejected — control, not vibes."],
  ["Who builds Matrix Builder?", "Created and maintained in the open by Ruslan Magana, as part of the Matrix ecosystem (agent-generator, matrix-definitions, MatrixHub, GitPilot)."],
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Matrix Builder",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Web",
      description:
        "Matrix Builder turns software ideas into controlled AI build contracts with blueprints, standards, prompts, tasks, and validation.",
      url: URL,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      creator: { "@type": "Person", name: "Ruslan Magana", url: "https://ruslanmv.com" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    },
  ],
};

const rise = (i: number) => ({ animationDelay: `${i * 90}ms` });

export default function AboutPage() {
  return (
    <div className="mb-about">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="mb-about-nav">
        <div className="l-wrap mb-about-nav-in">
          <Link href="/matrix-builder" className="l-brand"><span className="gl">◇</span>Matrix Builder</Link>
          <nav className="mb-about-links">
            <Link href="/matrix-builder">Open app</Link>
            <a className="gh" href="https://github.com/agent-matrix/matrix-builder" target="_blank" rel="noreferrer">GitHub</a>
            <AuthControls />
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mb-about-hero">
        <div className="mb-about-grid-bg" aria-hidden="true" />
        <div className="l-wrap mb-about-hero-grid">
          <div className="mb-about-hero-copy">
            <span className="mb-about-eyebrow mb-about-rise" style={rise(0)}><span className="dot" /> Controlled AI coding</span>
            <h1 className="mb-about-h1 mb-about-rise" style={rise(1)}>Give AI coders a <em>contract</em>, not a prompt.</h1>
            <p className="mb-about-sub mb-about-rise" style={rise(2)}>
              Matrix Builder turns your software idea into a controlled build bundle —
              blueprint, locked standards, tasks, prompts, and validation — before you ship.
            </p>
            <div className="mb-about-cta mb-about-rise" style={rise(3)}>
              <Link className="mb-about-btn primary" href="/matrix-builder">Start building <span aria-hidden="true">→</span></Link>
              <a className="mb-about-btn ghost" href="#how-it-works">See how it works</a>
            </div>
            <div className="mb-about-works mb-about-rise" style={rise(4)}>Works with Claude Code · Codex · Cursor · GitPilot · IBM Bob</div>
          </div>

          {/* animated idea → validated flow */}
          <ol className="mb-about-flow mb-about-rise" style={rise(2)} aria-label="From idea to validated build">
            {["Idea", "Blueprint", "Matrix Bundle", "AI coder", "Validated build"].map((label, i) => (
              <li key={label} className="mb-about-flow-node" style={{ animationDelay: `${i * 0.5}s` }}>
                <span className="mb-about-flow-dot" /><span className="mb-about-flow-label">{label}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Problem ── */}
      <section className="mb-about-section">
        <div className="l-wrap">
          <div className="mb-about-head">
            <span className="mb-about-kicker">The problem</span>
            <h2 className="mb-about-h2">AI coding is fast. Uncontrolled AI coding is expensive.</h2>
            <p className="mb-about-lead">A prompt gets you code. But without structure, standards, and validation, every AI build becomes a risky black box.</p>
          </div>
          <div className="mb-about-cards three">
            {[
              ["Unclear scope", "AI agents guess architecture, edge cases, and acceptance criteria."],
              ["Inconsistent standards", "Every run can produce a different structure, style, or security posture."],
              ["Hard to validate", "You get code, but not a clear way to prove it matches the original intent."],
            ].map(([t, d], i) => (
              <article key={t} className="mb-about-card mb-about-rise" style={rise(i)}><h3>{t}</h3><p>{d}</p></article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution ── */}
      <section className="mb-about-section alt">
        <div className="l-wrap">
          <div className="mb-about-head">
            <span className="mb-about-kicker">The control layer</span>
            <h2 className="mb-about-h2">Matrix Builder creates the missing control layer.</h2>
            <p className="mb-about-lead">Instead of sending a raw prompt to an AI coder, Matrix Builder creates a build contract the AI must follow.</p>
          </div>
          <div className="mb-about-cards four">
            {[
              ["Blueprint", "A structured architecture plan before any code begins."],
              ["Standards lock", "Rules, definitions, and acceptance criteria attached to the build."],
              ["Coder prompt", "Ready-to-use instructions for Claude Code, Codex, GitPilot & more."],
              ["Validation", "Check the result against the contract before you ship."],
            ].map(([t, d], i) => (
              <article key={t} className="mb-about-card glow mb-about-rise" style={rise(i)}><h3>{t}</h3><p>{d}</p></article>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mb-about-section" id="how-it-works">
        <div className="l-wrap">
          <div className="mb-about-head">
            <span className="mb-about-kicker">How it works</span>
            <h2 className="mb-about-h2">From idea to controlled build in minutes.</h2>
          </div>
          <ol className="mb-about-steps">
            {[
              ["Describe what you want", "Write the product idea — an agent, app, tool, or workflow."],
              ["Choose a blueprint", "Matrix Builder proposes controlled architecture candidates."],
              ["Generate the Matrix Bundle", "Get the blueprint, locked standards, tasks, prompts, and validation criteria."],
              ["Send it to your AI coder", "Use the generated prompt with Claude Code, Codex, GitPilot, or any AI coder."],
              ["Validate before you ship", "Check whether the output follows the contract — approve, repair, or reject."],
            ].map(([t, d], i) => (
              <li key={t} className="mb-about-step mb-about-rise" style={rise(i)}><span className="mb-about-step-n">{i + 1}</span><div><h3>{t}</h3><p>{d}</p></div></li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Before / after ── */}
      <section className="mb-about-section alt">
        <div className="l-wrap">
          <div className="mb-about-head"><span className="mb-about-kicker">The difference</span><h2 className="mb-about-h2">Stop shipping from loose prompts.</h2></div>
          <div className="mb-about-compare">
            <div className="mb-about-col bad">
              <div className="mb-about-col-h">Raw prompt</div>
              <code>“Build me a GitHub repo intelligence agent.”</code>
              <ul>{["No architecture lock", "No acceptance criteria", "No validation trail", "No reusable contract"].map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div className="mb-about-col good">
              <div className="mb-about-col-h">Matrix Bundle</div>
              <code>Blueprint + standards + tasks + coder prompt + validation.</code>
              <ul>{["Clear scope", "Controlled execution", "Reusable contract", "Safer AI output"].map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Inside a bundle ── */}
      <section className="mb-about-section">
        <div className="l-wrap mb-about-bundle">
          <div className="mb-about-head left">
            <span className="mb-about-kicker">What's inside</span>
            <h2 className="mb-about-h2">A Matrix Bundle is more than code.</h2>
            <p className="mb-about-lead">It's a controlled build contract — signed, checksummed, and reproducible.</p>
          </div>
          <div className="mb-about-files mb-about-rise" style={rise(1)}>
            {["MATRIX_BLUEPRINT.yaml", "MATRIX_STANDARDS.lock", "MATRIX_TASKS.md", "MATRIX_ALLOWED_CHANGES.md", "MATRIX_ACCEPTANCE_CRITERIA.md", "MATRIX_VALIDATION.md", "coder-prompts/claude-code.md", "coder-prompts/codex-chatgpt.md", "coder-prompts/gitpilot.md", "artifacts/manifest.json"].map((f) => (
              <div className="mb-about-file" key={f}><span className="mb-about-file-ic">◇</span>{f}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why different (table) ── */}
      <section className="mb-about-section alt" id="trust">
        <div className="l-wrap">
          <div className="mb-about-head"><span className="mb-about-kicker">Why it's different</span><h2 className="mb-about-h2">Not another AI app builder. A control layer.</h2></div>
          <div className="mb-about-table">
            <div className="mb-about-trow head"><span>Raw prompt tool</span><span>Matrix Builder</span></div>
            {[
              ["Vague prompt", "Controlled bundle"],
              ["Random files", "Allowed-files scope"],
              ["Hidden assumptions", "Explicit blueprint"],
              ["No standards lock", "Signed standards lock"],
              ["No validation", "Repair + validation"],
              ["Hard to reuse", "Publish to MatrixHub"],
            ].map(([l, r]) => (
              <div className="mb-about-trow" key={r}><span className="bad">{l}</span><span className="good">✓ {r}</span></div>
            ))}
          </div>
          <div className="mb-about-badges">{["REST API", "Matrix Bundle", "Validation", "MCP-ready", "Signed standards", "Open source · MIT"].map((b) => <span key={b} className="mb-about-badge">{b}</span>)}</div>
        </div>
      </section>

      {/* ── Ecosystem ── */}
      <section className="mb-about-section">
        <div className="l-wrap">
          <div className="mb-about-head"><span className="mb-about-kicker">The ecosystem</span><h2 className="mb-about-h2">Built on the Matrix ecosystem by Ruslan Magana.</h2></div>
          <div className="mb-about-cards four">
            {[
              ["Matrix Builder", "The product — idea to validated bundle."],
              ["agent-generator", "The deterministic generation + validation engine."],
              ["matrix-definitions", "The signed standards — the source of truth."],
              ["MatrixHub", "The registry of trusted, validated bundles."],
            ].map(([t, d], i) => <article key={t} className="mb-about-card mb-about-rise" style={rise(i)}><h3>{t}</h3><p>{d}</p></article>)}
          </div>
        </div>
      </section>

      {/* ── Use cases ── */}
      <section className="mb-about-section alt">
        <div className="l-wrap">
          <div className="mb-about-head"><span className="mb-about-kicker">Use cases</span><h2 className="mb-about-h2">What can you build?</h2></div>
          <div className="mb-about-cards three">
            {[
              ["GitHub repo intelligence agents", "Understand repositories, issues, PRs, and CI failures."],
              ["Document Q&A assistants", "Controlled assistants over PDFs, docs, and knowledge bases."],
              ["Portfolio reviewers", "Analyze developer projects and suggest improvements."],
              ["Internal workflow agents", "Turn business processes into structured AI agent tasks."],
              ["AI coding handoffs", "Give another AI coder a complete contract, not a vague request."],
              ["Validation-first prototypes", "Ship prototypes with acceptance criteria from day one."],
            ].map(([t, d], i) => <article key={t} className="mb-about-card mb-about-rise" style={rise(i)}><h3>{t}</h3><p>{d}</p></article>)}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="mb-about-section">
        <div className="l-wrap mb-about-faqwrap">
          <div className="mb-about-head"><span className="mb-about-kicker">FAQ</span><h2 className="mb-about-h2">Questions, answered.</h2></div>
          <div className="mb-about-faq">
            {FAQ.map(([q, a]) => (
              <details key={q} className="mb-about-q"><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="mb-about-final">
        <div className="l-wrap mb-about-final-in">
          <h2>Build with control. Ship with confidence.</h2>
          <p>Turn your next software idea into a structured AI build contract.</p>
          <div className="mb-about-cta">
            <Link className="mb-about-btn primary" href="/matrix-builder">Open Matrix Builder <span aria-hidden="true">→</span></Link>
            <a className="mb-about-btn ghost" href="https://agent-matrix.github.io/matrix-builder/site/" target="_blank" rel="noreferrer">Read the docs</a>
          </div>
        </div>
      </section>

      <footer className="mb-about-foot">
        <div className="l-wrap mb-about-foot-in">
          <span>© 2026 Matrix Builder · <a href="https://ruslanmv.com">Ruslan Magana</a> · MIT</span>
          <span><Link href="/matrix-builder">App</Link> · <a href="https://agent-matrix.github.io/matrix-builder/site/" target="_blank" rel="noreferrer">Docs</a> · <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link> · <a href="https://github.com/agent-matrix/matrix-builder">GitHub</a></span>
        </div>
      </footer>
    </div>
  );
}
