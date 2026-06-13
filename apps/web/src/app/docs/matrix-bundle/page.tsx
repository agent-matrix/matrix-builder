const STYLE = { padding: "64px", maxWidth: 760, fontFamily: "Inter, system-ui, sans-serif", lineHeight: 1.6 } as const;

export default function Page() {
  return (
    <main style={STYLE}>
      <p style={{ color: "#16a34a", fontWeight: 700 }}>Docs · Matrix Bundle</p>
      <h1>What&rsquo;s in a Matrix Bundle</h1>
      <p>
        A Matrix Bundle is a controlled build package generated from your idea. It contains the
        contract files, documentation, and ready-to-use prompts for each supported AI coder.
      </p>
      <ul>
        <li>The contract (see <a href="/docs/ai-coder-contract">AI-coder contract</a>).</li>
        <li><code>docs/</code> — architecture, security, and a standards report.</li>
        <li><code>coder-prompts/</code> — a contract-bound prompt per coder (Claude Code, Codex, Cursor, GitPilot, IBM Bob, generic).</li>
        <li><code>artifacts/manifest.json</code> — the content-addressed file manifest.</li>
      </ul>
      <p>
        Generation is deterministic: the same idea and quality level always produce the same
        bundle, so it can be validated and published reproducibly.
      </p>
    </main>
  );
}
