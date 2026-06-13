"use client";

import { useEffect, useState } from "react";
import { apiBaseUrl } from "@/lib/api-client";
import { setSession, type AuthUser } from "@/lib/auth-token";

type State = "working" | "ok" | "error";

export default function VerifyPage() {
  const [state, setState] = useState<State>("working");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState("error");
      return;
    }
    fetch(`${apiBaseUrl}/api/v1/auth/email/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("verify failed"))))
      .then((data: { access_token: string; user?: AuthUser }) => {
        setSession(data.access_token, data.user ?? {});
        setState("ok");
        setTimeout(() => {
          window.location.href = "/matrix-builder";
        }, 900);
      })
      .catch(() => setState("error"));
  }, []);

  const copy =
    state === "working"
      ? { h: "Confirming your email…", p: "Hang tight while we sign you in." }
      : state === "ok"
        ? { h: "You're signed in", p: "Taking you to Matrix Builder…" }
        : { h: "This link didn't work", p: "It may have expired or already been used. Request a new sign-in link." };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(180deg,#03190f,#02170f 60%,#01100b)",
        color: "#f7fff9",
        fontFamily: "'Hanken Grotesk',system-ui,-apple-system,'Segoe UI',sans-serif",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          textAlign: "center",
          border: "1px solid rgba(123,255,184,.16)",
          borderRadius: 24,
          padding: "40px 32px",
          background: "rgba(8,39,28,.5)",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            margin: "0 auto 20px",
            display: "grid",
            placeItems: "center",
            borderRadius: 12,
            border: "1px solid rgba(34,200,120,.6)",
            color: "#53f39d",
            fontSize: 22,
          }}
        >
          ◇
        </div>
        <h1 style={{ fontFamily: "'Newsreader',Georgia,serif", fontSize: 28, fontWeight: 600, margin: "0 0 10px" }}>
          {copy.h}
        </h1>
        <p style={{ color: "#a7c9b8", fontSize: 15, lineHeight: 1.6, margin: 0 }}>{copy.p}</p>
        {state === "error" && (
          <a
            href="/matrix-builder"
            style={{
              display: "inline-block",
              marginTop: 22,
              padding: "12px 22px",
              borderRadius: 12,
              fontWeight: 700,
              color: "#04140c",
              background: "linear-gradient(180deg,#53f39d,#22c878)",
              textDecoration: "none",
            }}
          >
            Back to Matrix Builder
          </a>
        )}
      </div>
    </main>
  );
}
