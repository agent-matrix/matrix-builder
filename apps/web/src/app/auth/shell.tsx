"use client";

import type { ReactNode } from "react";

/** Shared branded full-page shell for the /auth/* confirmation + form pages. */
export function AuthShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(180deg,#03190f,#02170f 60%,#01100b)",
        color: "#f7fff9",
        fontFamily: "'Hanken Grotesk',system-ui,-apple-system,'Segoe UI',sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 420, width: "100%", textAlign: "center", border: "1px solid rgba(123,255,184,.16)", borderRadius: 24, padding: "40px 32px", background: "rgba(8,39,28,.5)" }}>
        <div style={{ width: 44, height: 44, margin: "0 auto 20px", display: "grid", placeItems: "center", borderRadius: 12, border: "1px solid rgba(34,200,120,.6)", color: "#53f39d", fontSize: 22 }}>◇</div>
        <h1 style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 28, fontWeight: 600, margin: "0 0 10px" }}>{title}</h1>
        {subtitle && <p style={{ color: "#a7c9b8", fontSize: 15, lineHeight: 1.6, margin: 0 }}>{subtitle}</p>}
        {children}
        {action && (
          <a href={action.href} style={{ display: "inline-block", marginTop: 22, padding: "12px 22px", borderRadius: 12, fontWeight: 700, color: "#04140c", background: "linear-gradient(180deg,#53f39d,#22c878)", textDecoration: "none" }}>
            {action.label}
          </a>
        )}
      </div>
    </main>
  );
}
