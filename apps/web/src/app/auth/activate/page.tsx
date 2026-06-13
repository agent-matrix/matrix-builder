"use client";

import { useEffect, useState } from "react";
import { apiBaseUrl } from "@/lib/api-client";
import { setSession, type AuthUser } from "@/lib/auth-token";
import { AuthShell } from "../shell";

export default function ActivatePage() {
  const [state, setState] = useState<"working" | "ok" | "error">("working");

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) return setState("error");
    fetch(`${apiBaseUrl}/api/v1/auth/activate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("activate failed"))))
      .then((data: { access_token: string; user?: AuthUser }) => {
        setSession(data.access_token, data.user ?? {});
        setState("ok");
        setTimeout(() => (window.location.href = "/matrix-builder"), 900);
      })
      .catch(() => setState("error"));
  }, []);

  if (state === "working") return <AuthShell title="Activating your account…" subtitle="One moment while we confirm your email." />;
  if (state === "ok") return <AuthShell title="Account activated" subtitle="You're signed in — taking you to Matrix Builder…" />;
  return (
    <AuthShell
      title="This link didn't work"
      subtitle="It may have expired or already been used. Sign in to request a new one."
      action={{ href: "/matrix-builder", label: "Go to Matrix Builder" }}
    />
  );
}
