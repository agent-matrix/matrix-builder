"use client";

import { useEffect, useRef, useState } from "react";
import { apiBaseUrl } from "@/lib/api-client";
import { AUTH_EVENT, clearSession, getUser, setSession, type AuthUser } from "@/lib/auth-token";

const ENV_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const EMAIL_RE = /\S+@\S+\.\S+/;

type GisId = {
  initialize: (opts: {
    client_id: string;
    callback: (r: { credential: string }) => void;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GisId } };
  }
}

/** True when we're embedded (e.g. the Hugging Face Spaces iframe), where Google popups are blocked. */
function inIframe(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

// ---- Google Identity Services: initialised exactly once, globally. -------------------------
let gisPromise: Promise<void> | null = null;
let gisInitFor: string | null = null;

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

async function onGoogleCredential(resp: { credential: string }): Promise<void> {
  try {
    const res = await fetch(`${apiBaseUrl}/api/v1/auth/google`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credential: resp.credential }),
    });
    if (!res.ok) throw new Error(`auth ${res.status}`);
    const data = (await res.json()) as { access_token: string; user?: AuthUser };
    setSession(data.access_token, data.user ?? {}); // broadcasts AUTH_EVENT → all buttons update
  } catch {
    /* swallow — the email flow is always available as the primary path */
  }
}

function ensureGoogleInit(clientId: string): void {
  if (gisInitFor === clientId || !window.google?.accounts?.id) return;
  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: onGoogleCredential,
    cancel_on_tap_outside: true,
  });
  gisInitFor = clientId;
}

function initials(user: AuthUser): string {
  return (user.name || user.email || "U")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

type EmailState = "idle" | "sending" | "sent";

export default function AuthControls({ onNotice }: { onNotice?: (message: string) => void }) {
  const [user, setLocalUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(ENV_CLIENT_ID);
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<EmailState>("idle");
  const [error, setError] = useState<string | null>(null);
  const btnRef = useRef<HTMLDivElement | null>(null);

  const validEmail = EMAIL_RE.test(email.trim());
  const showGoogle = Boolean(clientId) && !inIframe();

  // Keep every Sign-in button in sync (sign in from one place → all reflect it).
  useEffect(() => {
    const refresh = () => setLocalUser(getUser());
    refresh();
    window.addEventListener(AUTH_EVENT, refresh);
    window.addEventListener("storage", refresh);
    if (!ENV_CLIENT_ID) {
      fetch(`${apiBaseUrl}/api/v1/auth/status`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { google_client_id?: string } | null) => {
          if (d?.google_client_id) setClientId(d.google_client_id);
        })
        .catch(() => {});
    }
    return () => {
      window.removeEventListener(AUTH_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Render Google's button only when it can actually work (top-level + configured).
  useEffect(() => {
    if (!open || !showGoogle) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !window.google || !btnRef.current) return;
        ensureGoogleInit(clientId);
        btnRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(btnRef.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text: "continue_with",
          width: 300,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, showGoogle, clientId]);

  function openModal() {
    setEmail("");
    setError(null);
    setEmailState("idle");
    setOpen(true);
  }

  async function submitEmail() {
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setEmailState("sending");
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/email/request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      if (!res.ok) throw new Error(`email ${res.status}`);
      setEmailState("sent");
    } catch {
      setEmailState("idle");
      setError("Couldn't send the link. Please try again.");
    }
  }

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
          aria-label="Sign in or create your account"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="auth-card">
            <button className="auth-x" type="button" aria-label="Close" onClick={() => setOpen(false)}>
              ×
            </button>
            <div className="auth-mark">◇</div>

            {emailState === "sent" ? (
              <>
                <div className="auth-h">Check your email</div>
                <p className="auth-sub">
                  We sent a secure sign-in link to <strong style={{ color: "#f7fff9" }}>{email.trim().toLowerCase()}</strong>.
                  It expires in 15 minutes and can be used once.
                </p>
                <button
                  className="auth-email"
                  type="button"
                  style={{ background: "transparent", borderColor: "rgba(236,255,244,.18)", color: "#cfe0d6" }}
                  onClick={() => {
                    setEmailState("idle");
                    setEmail("");
                  }}
                >
                  Use a different email
                </button>
                <div className="auth-legal">Didn&apos;t get it? Check spam, or try again in a minute.</div>
              </>
            ) : (
              <>
                <div className="auth-h">Sign in or create your account</div>
                <p className="auth-sub">
                  Enter your email and we&apos;ll send a secure sign-in link — no passwords to set or recover.
                </p>

                <label htmlFor="mb-auth-email" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
                  Email address
                </label>
                <input
                  id="mb-auth-email"
                  className="auth-field"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@company.com"
                  value={email}
                  disabled={emailState === "sending"}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitEmail();
                  }}
                />
                {error && (
                  <div style={{ color: "#ff9b9b", fontSize: 13, margin: "2px 2px 8px" }}>{error}</div>
                )}
                <button
                  className="auth-email"
                  type="button"
                  disabled={!validEmail || emailState === "sending"}
                  onClick={() => void submitEmail()}
                >
                  {emailState === "sending" ? "Sending…" : "Continue with email"} <span aria-hidden="true">→</span>
                </button>

                {showGoogle && (
                  <>
                    <div className="auth-or">or</div>
                    <div ref={btnRef} style={{ display: "flex", justifyContent: "center", minHeight: 44 }} />
                  </>
                )}

                <div className="auth-legal">
                  We&apos;ll email you a secure link — no passwords. By continuing you agree to the Terms &amp; Privacy.
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
