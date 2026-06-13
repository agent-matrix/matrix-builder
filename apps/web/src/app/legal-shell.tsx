import Link from "next/link";
import type { ReactNode } from "react";

/** Simple, readable dark page used by /terms and /privacy. */
export function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#03190f,#02170f 60%,#01100b)",
        color: "#eafff4",
        fontFamily: "'Hanken Grotesk',system-ui,-apple-system,'Segoe UI',sans-serif",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 24px 96px" }}>
        <Link href="/matrix-builder" style={{ color: "#53f39d", textDecoration: "none", fontWeight: 600, fontSize: 14 }}>
          ◇ Matrix Builder
        </Link>
        <h1 style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em", margin: "26px 0 6px" }}>
          {title}
        </h1>
        <p style={{ color: "#6f9482", fontSize: 13, margin: "0 0 28px" }}>Last updated: {updated}</p>
        <div className="legal-prose" style={{ color: "#bcd8ca", fontSize: 15.5, lineHeight: 1.7 }}>
          {children}
        </div>
      </div>
    </main>
  );
}
