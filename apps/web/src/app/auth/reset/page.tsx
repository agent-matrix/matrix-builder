"use client";

import { useEffect, useState } from "react";
import { apiBaseUrl } from "@/lib/api-client";
import { setSession, type AuthUser } from "@/lib/auth-token";
import { AuthShell } from "../shell";

export default function ResetPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token"));
  }, []);

  async function submit() {
    if (busy) return;
    if (password.length < 8) return setError("Use a password of at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/password/reset`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        let detail = "This reset link didn't work — it may have expired.";
        try {
          const d = await res.json();
          if (typeof d?.detail === "string") detail = d.detail;
        } catch {
          /* keep */
        }
        throw new Error(detail);
      }
      const data = (await res.json()) as { access_token: string; user?: AuthUser };
      setSession(data.access_token, data.user ?? {});
      setDone(true);
      setTimeout(() => (window.location.href = "/matrix-builder"), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <AuthShell title="Password updated" subtitle="You're signed in — taking you to Matrix Builder…" />;
  if (!token) return <AuthShell title="Invalid reset link" subtitle="Please request a new password-reset link." action={{ href: "/matrix-builder", label: "Go to Matrix Builder" }} />;

  const field: React.CSSProperties = {
    width: "100%", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.14)",
    borderRadius: 12, minHeight: 48, padding: "0 15px", color: "#fff", fontSize: 15, marginTop: 10, outline: "none",
  };
  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password for your account.">
      <div style={{ marginTop: 18 }}>
        <input style={field} type="password" autoComplete="new-password" placeholder="New password (min 8 chars)"
          value={password} onChange={(e) => { setPassword(e.target.value); error && setError(null); }} />
        <input style={field} type="password" autoComplete="new-password" placeholder="Confirm password"
          value={confirm} onChange={(e) => { setConfirm(e.target.value); error && setError(null); }}
          onKeyDown={(e) => e.key === "Enter" && void submit()} />
        {error && <div style={{ color: "#ff9b9b", fontSize: 13, marginTop: 10 }}>{error}</div>}
        <button type="button" disabled={busy} onClick={() => void submit()}
          style={{ width: "100%", marginTop: 14, minHeight: 50, border: 0, borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer", color: "#04140c", background: "linear-gradient(120deg,#22c878,#0e9a57)" }}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </div>
    </AuthShell>
  );
}
