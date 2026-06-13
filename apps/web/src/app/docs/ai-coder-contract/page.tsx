const STYLE = { padding: "64px", maxWidth: 760, fontFamily: "Inter, system-ui, sans-serif", lineHeight: 1.6 } as const;

export default function Page() {
  return (
    <main style={STYLE}>
      <p style={{ color: "#16a34a", fontWeight: 700 }}>Docs · AI-coder contract</p>
      <h1>The contract an AI coder must follow</h1>
      <p>
        Every Matrix Bundle ships a machine-readable contract so an AI coder builds under control
        instead of guessing. It is composed of these files:
      </p>
      <ul>
        <li><code>MATRIX_BLUEPRINT.yaml</code> — the architecture, stack, and pages (immutable).</li>
        <li><code>MATRIX_STANDARDS.lock</code> — the pinned standards the build must satisfy.</li>
        <li><code>MATRIX_TASKS.md</code> — the scoped tasks, each with its allowed files.</li>
        <li><code>MATRIX_ALLOWED_CHANGES.md</code> — the directories a coder may edit.</li>
        <li><code>MATRIX_ACCEPTANCE_CRITERIA.md</code> — what &ldquo;done&rdquo; means per task.</li>
        <li><code>MATRIX_VALIDATION.md</code> — how the result is checked.</li>
      </ul>
      <p>
        The coder edits only the allowed files; control files are forbidden to change. Output is
        then validated against this contract (see <a href="/docs/validation">Validation</a>).
      </p>
    </main>
  );
}
