import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", padding: "96px 24px", textAlign: "center" }}>
      <p style={{ color: "#41f09a", fontWeight: 700 }}>Matrix Builder</p>
      <h1 style={{ fontSize: "clamp(40px, 8vw, 88px)", margin: "16px auto", maxWidth: 900 }}>
        Give AI coders a contract, not a prompt.
      </h1>
      <p style={{ color: "#9aa8bc", maxWidth: 720, margin: "0 auto 32px" }}>
        Describe your idea, choose a blueprint, and generate a controlled Matrix Bundle for Claude Code, Codex, GitPilot, IBM Bob, Cursor, or any AI coder.
      </p>
      <Link href="/matrix-builder" style={{ background: "#41f09a", color: "#06100a", padding: "14px 22px", borderRadius: 999, fontWeight: 800 }}>
        Open Matrix Builder
      </Link>
    </main>
  );
}
