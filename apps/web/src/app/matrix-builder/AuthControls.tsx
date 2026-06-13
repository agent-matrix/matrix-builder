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
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const btnRef = useRef<HTMLDivElement | null>(null);
  const validEmail = /\S+@\S+\.\S+/.test(email);

  function openModal() {
    setEmail("");
    setEmailSent(false);
    setOpen(true);
  }

  async function submitEmail() {
    if (!validEmail || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/email/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(`email ${res.status}`);
      setEmailSent(true);
    } catch {
      onNotice?.("Couldn't send the sign-in link — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

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
      <button className="l-signin" type="button" onClick={openModal}>
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
            <div className="auth-h">Save your Matrix Bundle</div>
            <p className="auth-sub">
              Create a free account to keep your bundles private, reuse them later, and validate AI-generated results.
            </p>

            {emailSent ? (
              <div style={{ margin: "18px 0 6px" }}>
                <div className="auth-h" style={{ fontSize: 18 }}>Check your inbox</div>
                <p className="auth-sub">
                  We sent a one-time sign-in link to <strong style={{ color: "#f7fff9" }}>{email}</strong>. It expires
                  in 15 minutes. You can close this window.
                </p>
              </div>
            ) : (
              <>
                {/* Google's button renders here when configured (matches the white "Continue with Google"). */}
                <div ref={btnRef} style={{ display: "flex", justifyContent: "center", minHeight: clientId ? 44 : 0 }} />
                <div className="auth-or">or</div>
                <input
                  className="auth-field"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitEmail();
                  }}
                />
                <button
                  className="auth-email"
                  type="button"
                  disabled={!validEmail || submitting}
                  onClick={() => void submitEmail()}
                >
                  {submitting ? "Sending…" : "Continue with email"} <span aria-hidden="true">→</span>
                </button>
                <div className="auth-legal">
                  We&apos;ll email you a magic link — no passwords. By continuing you agree to the Terms &amp; Privacy.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
