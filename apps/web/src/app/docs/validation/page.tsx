const STYLE = { padding: "64px", maxWidth: 760, fontFamily: "Inter, system-ui, sans-serif", lineHeight: 1.6 } as const;

export default function Page() {
  return (
    <main style={STYLE}>
      <p style={{ color: "#16a34a", fontWeight: 700 }}>Docs · Validation</p>
      <h1>How validation works</h1>
      <p>
        When an AI coder submits a change, Matrix Builder validates it against the bundle&rsquo;s
        contract and returns one verdict:
      </p>
      <ul>
        <li><strong>Passed</strong> — changes stayed within the allowlist; a commit is recorded.</li>
        <li><strong>Needs repair</strong> — changes drifted outside scope; a repair batch is offered.</li>
        <li><strong>Rejected</strong> — a forbidden control file was modified.</li>
      </ul>
      <p>
        Checks include forbidden-file edits, allowlist scope, required files, dependency drift, and
        secret scanning. A failing run produces a bounded repair prompt you can hand straight back
        to the coder. Validation is the single authority — the same engine runs locally
        (<code>mb check</code>) and in the API.
      </p>
    </main>
  );
}
