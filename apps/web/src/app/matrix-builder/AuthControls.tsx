"use client";

import { useEffect, useRef, useState } from "react";
import { apiBaseUrl } from "@/lib/api-client";
import { clearSession, getUser, setSession, type AuthUser } from "@/lib/auth-token";

const ENV_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const GIS_SRC = "https://accounts.google.com/gsi/client";

type GisId = {
  initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GisId } };
  }
}

let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = GIS_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("failed to load Google Identity Services"));
      document.head.appendChild(s);
    });
  }
  return gisPromise;
}

function initials(user: AuthUser): string {
  return (user.name || user.email || "U")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export default function AuthControls({ onNotice }: { onNotice?: (message: string) => void }) {
  const [user, setLocalUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(ENV_CLIENT_ID);
  const btnRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLocalUser(getUser());
    // If the client id wasn't inlined at build time, discover it from the backend at runtime.
    if (ENV_CLIENT_ID) return;
    fetch(`${apiBaseUrl}/api/v1/auth/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { google_client_id?: string } | null) => {
        if (d?.google_client_id) setClientId(d.google_client_id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open || !clientId) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !window.google || !btnRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (resp) => {
            try {
              const res = await fetch(`${apiBaseUrl}/api/v1/auth/google`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ credential: resp.credential }),
              });
              if (!res.ok) throw new Error(`auth ${res.status}`);
              const data = (await res.json()) as { access_token: string; user?: AuthUser };
              const u = data.user ?? {};
              setSession(data.access_token, u);
              setLocalUser(u);
              setOpen(false);
              onNotice?.(u.name ? `Signed in as ${u.name}` : "Signed in");
            } catch {
              onNotice?.("Sign in failed — please try again.");
            }
          },
        });
        btnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 280,
        });
      })
      .catch(() => onNotice?.("Could not reach Google sign-in."));
    return () => {
      cancelled = true;
    };
  }, [open, clientId, onNotice]);

  if (user) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <span
          title={user.email ?? undefined}
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            fontWeight: 800,
            fontSize: 13,
            color: "#04140c",
            background: "linear-gradient(180deg,#53f39d,#22c878)",
          }}
        >
          {initials(user)}
        </span>
        <button
          className="mb-back"
          type="button"
          onClick={() => {
            clearSession();
            setLocalUser(null);
            onNotice?.("Signed out");
          }}
        >
          Sign out
        </button>
      </span>
    );
  }

  return (
    <>
      <button
        className="l-signin"
        type="button"
        onClick={() => (clientId ? setOpen(true) : onNotice?.("Google sign-in is not configured yet."))}
      >
        Sign in
      </button>
      {open && (
        <div
          className="auth-scrim"
          role="dialog"
          aria-modal="true"
          aria-label="Sign in"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="auth-card">
            <button className="auth-x" type="button" aria-label="Close" onClick={() => setOpen(false)}>
              ×
            </button>
            <div className="auth-mark">◇</div>
            <div className="auth-h">Sign in to Matrix Builder</div>
            <p className="auth-sub">Save your Matrix Bundles, reuse them later, and validate AI-generated results.</p>
            <div ref={btnRef} style={{ display: "flex", justifyContent: "center", minHeight: 44, margin: "8px 0" }} />
            <div className="auth-legal">No passwords — Google verifies you. By continuing you agree to the Terms &amp; Privacy.</div>
          </div>
        </div>
      )}
    </>
  );
}
