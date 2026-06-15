"use client";

// Dependency-free unified-diff viewer (Batch 11).
//
// The web app keeps a minimal dependency footprint (next/react only), so rather
// than pull in Monaco/an editor we render the proxied diff text with line-level
// colouring. Read-only, scrollable, monospaced — enough to review a GitPilot
// change in the browser before Matrix approves it.

import { parseDiffLines, type DiffLineKind } from "@/lib/gitpilot-client";

const COLORS: Record<DiffLineKind, { color: string; bg: string }> = {
  add: { color: "#22c878", bg: "rgba(34,200,120,.10)" },
  del: { color: "#ff6b6b", bg: "rgba(255,107,107,.10)" },
  hunk: { color: "#53b9ff", bg: "rgba(83,185,255,.08)" },
  meta: { color: "#8aa0b4", bg: "transparent" },
  context: { color: "#c9d4df", bg: "transparent" },
};

export default function DiffView({ diff }: { diff: string }) {
  const lines = parseDiffLines(diff);
  if (!diff.trim()) {
    return <div className="diffview-empty">No diff to show.</div>;
  }
  return (
    <pre
      className="diffview"
      style={{
        maxHeight: 360,
        overflow: "auto",
        margin: 0,
        padding: "10px 12px",
        borderRadius: 10,
        background: "#02140c",
        border: "1px solid rgba(34,200,120,.18)",
        fontSize: 12.5,
        lineHeight: 1.55,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      }}
    >
      {lines.map((l, i) => {
        const c = COLORS[l.kind];
        return (
          <div key={i} style={{ color: c.color, background: c.bg, whiteSpace: "pre-wrap" }}>
            {l.text || " "}
          </div>
        );
      })}
    </pre>
  );
}
