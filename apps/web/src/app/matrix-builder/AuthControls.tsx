"use client";

import { useEffect, useRef, useState } from "react";
import { apiBaseUrl } from "@/lib/api-client";
import { AUTH_EVENT, clearSession, getUser, setSession, type AuthUser } from "@/lib/auth-token";

const ENV_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const EMAIL_RE = /\S+@\S+\.\S+/;

type GisId = {
  initialize: (opts: { client_id: string; callback: (r: { credential: string }) => void; cancel_on_tap_outside?: boolean }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GisId } };
  }
}

// ---- Google Identity Services: loaded + initialised once, globally. ------------------------
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
      s.onerror = () => reject(new Error("gis load failed"));
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
    setSession(data.access_token, data.user ?? {}); // broadcasts AUTH_EVENT
  } catch {
    /* email/password is always available */
  }
}
function ensureGoogleInit(clientId: string): void {
  if (gisInitFor === clientId || !window.google?.accounts?.id) return;
  window.google.accounts.id.initialize({ client_id: clientId, callback: onGoogleCredential, cancel_on_tap_outside: true });
  gisInitFor = clientId;
}

function initials(user: AuthUser): string {
  return (user.name || user.email || "U").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");
}

async function readDetail(res: Response, fallback: string): Promise<string> {
  try {
    const d = await res.json();
    if (typeof d?.detail === "string") return d.detail;
  } catch {
    /* keep fallback */
  }
  return fallback;
}

type View = "signin" | "signup1" | "signup2" | "pending" | "forgot" | "forgotSent";

export default function AuthControls({ onNotice }: { onNotice?: (message: string) => void }) {
  const [user, setLocalUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(ENV_CLIENT_ID);
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const btnRef = useRef<HTMLDivElement | null>(null);

  const validEmail = EMAIL_RE.test(email.trim());
  const showGoogle = Boolean(clientId);

  // Keep every Sign-in button in sync (sign in once → all reflect it).
  useEffect(() => {
    const refresh = () => setLocalUser(getUser());
    refresh();
    window.addEventListener(AUTH_EVENT, refresh);
    window.addEventListener("storage", refresh);
    if (!ENV_CLIENT_ID) {
      fetch(`${apiBaseUrl}/api/v1/auth/status`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { google_client_id?: string } | null) => d?.google_client_id && setClientId(d.google_client_id))
        .catch(() => {});
    }
    return () => {
      window.removeEventListener(AUTH_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Render Google's official button (dark theme) on the entry views.
  const googleVisible = open && showGoogle && (view === "signin" || view === "signup1");
  useEffect(() => {
    if (!googleVisible) return;
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
          logo_alignment: "left",
          width: 320,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [googleVisible, clientId, view]);

  function reset(next: View) {
    setError(null);
    setBusy(false);
    setPassword("");
    setConfirm("");
    setView(next);
  }
  function openModal() {
    setEmail("");
    setName("");
    reset("signin");
    setOpen(true);
  }

  async function submitLogin() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      if (!res.ok) throw new Error(await readDetail(res, "Incorrect email or password."));
      const data = (await res.json()) as { access_token: string; user?: AuthUser };
      setSession(data.access_token, data.user ?? {});
      setOpen(false);
      onNotice?.("Signed in");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitSignup() {
    if (busy) return;
    if (password.length < 8) return setError("Use a password of at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/signup`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, name: name.trim() || null }),
      });
      if (res.status === 409) {
        setError("An account with this email already exists — sign in instead.");
        reset("signin");
        return;
      }
      if (!res.ok) throw new Error(await readDetail(res, "Couldn't create your account."));
      reset("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create your account.");
    } finally {
      setBusy(false);
    }
  }

  async function submitForgot() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/password/forgot`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok && res.status !== 200) throw new Error(await readDetail(res, "Couldn't send the reset link."));
      reset("forgotSent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the reset link.");
    } finally {
      setBusy(false);
    }
  }

  // ---- signed-in chip ----------------------------------------------------------------------
  if (user) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
        <span title={user.email ?? undefined} className="mb-avatar">{initials(user)}</span>
        <button className="mb-back" type="button" onClick={() => { clearSession(); onNotice?.("Signed out"); }}>Sign out</button>
      </span>
    );
  }

  const GoogleBlock = showGoogle ? (
    <>
      <div className="auth-gshell"><div ref={btnRef} /></div>
      <div className="auth-or">or</div>
    </>
  ) : null;

  return (
    <>
      <button className="l-signin" type="button" onClick={openModal}>Sign in</button>
      {open && (
        <div className="auth-scrim" role="dialog" aria-modal="true" aria-label="Sign in"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="auth-card">
            <button className="auth-x" type="button" aria-label="Close" onClick={() => setOpen(false)}>×</button>
            <div className="auth-mark" style={view === "pending" || view === "forgotSent" ? { color: "#53f39d" } : undefined}>
              {view === "pending" || view === "forgotSent" ? "✓" : "◇"}
            </div>

            {/* ---- confirmation screens ---- */}
            {view === "pending" && (
              <>
                <div className="auth-h">Activate your account</div>
                <p className="auth-sub">We sent an activation link to <strong style={{ color: "#f7fff9" }}>{email.trim().toLowerCase()}</strong>. Click it to finish creating your account (expires in 15 min).</p>
                <button className="auth-ghost" type="button" onClick={() => reset("signin")}>Back to sign in</button>
                <div className="auth-legal">Didn&apos;t get it? Check spam, or try again in a minute.</div>
              </>
            )}
            {view === "forgotSent" && (
              <>
                <div className="auth-h">Check your email</div>
                <p className="auth-sub">If an account exists for <strong style={{ color: "#f7fff9" }}>{email.trim().toLowerCase()}</strong>, we&apos;ve sent a password-reset link (expires in 15 min).</p>
                <button className="auth-ghost" type="button" onClick={() => reset("signin")}>Back to sign in</button>
              </>
            )}

            {/* ---- sign in ---- */}
            {view === "signin" && (
              <>
                <div className="auth-tabs">
                  <button className="on" type="button">Sign in</button>
                  <button type="button" onClick={() => reset("signup1")}>Create account</button>
                </div>
                <div className="auth-h">Welcome back</div>
                <p className="auth-sub">Sign in to your Matrix Builder account.</p>
                {GoogleBlock}
                <input className="auth-field" type="email" inputMode="email" autoComplete="email" placeholder="you@company.com"
                  value={email} onChange={(e) => { setEmail(e.target.value); error && setError(null); }} />
                <input className="auth-field" style={{ marginTop: 10 }} type="password" autoComplete="current-password" placeholder="Password"
                  value={password} onChange={(e) => { setPassword(e.target.value); error && setError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && void submitLogin()} />
                {error && <div className="auth-err">{error}</div>}
                <button className="auth-email" type="button" disabled={!validEmail || !password || busy} onClick={() => void submitLogin()}>
                  {busy ? "Signing in…" : "Sign in"}
                </button>
                <div className="auth-foot">
                  <button type="button" onClick={() => reset("forgot")}>Forgot password?</button>
                  <span> · </span>
                  <button type="button" onClick={() => reset("signup1")}>Create account</button>
                </div>
              </>
            )}

            {/* ---- signup wizard: step 1 (email) ---- */}
            {view === "signup1" && (
              <>
                <div className="auth-tabs">
                  <button type="button" onClick={() => reset("signin")}>Sign in</button>
                  <button className="on" type="button">Create account</button>
                </div>
                <div className="auth-step">Step 1 of 2</div>
                <div className="auth-h">Create your account</div>
                <p className="auth-sub">Start with your email — we&apos;ll verify it to keep your bundles secure.</p>
                {GoogleBlock}
                <input className="auth-field" type="email" inputMode="email" autoComplete="email" placeholder="you@company.com"
                  value={email} onChange={(e) => { setEmail(e.target.value); error && setError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && validEmail && reset("signup2")} />
                {error && <div className="auth-err">{error}</div>}
                <button className="auth-email" type="button" disabled={!validEmail} onClick={() => reset("signup2")}>
                  Continue <span aria-hidden="true">→</span>
                </button>
                <div className="auth-foot"><button type="button" onClick={() => reset("signin")}>Already have an account? Sign in</button></div>
              </>
            )}

            {/* ---- signup wizard: step 2 (password) ---- */}
            {view === "signup2" && (
              <>
                <div className="auth-step">Step 2 of 2</div>
                <div className="auth-h">Set a password</div>
                <p className="auth-sub">Creating your account for <strong style={{ color: "#f7fff9" }}>{email.trim().toLowerCase()}</strong>.</p>
                <input className="auth-field" type="text" autoComplete="name" placeholder="Your name (optional)"
                  value={name} onChange={(e) => setName(e.target.value)} />
                <input className="auth-field" style={{ marginTop: 10 }} type="password" autoComplete="new-password" placeholder="Create a password (min 8 chars)"
                  value={password} onChange={(e) => { setPassword(e.target.value); error && setError(null); }} />
                <input className="auth-field" style={{ marginTop: 10 }} type="password" autoComplete="new-password" placeholder="Confirm password"
                  value={confirm} onChange={(e) => { setConfirm(e.target.value); error && setError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && void submitSignup()} />
                {error && <div className="auth-err">{error}</div>}
                <button className="auth-email" type="button" disabled={busy || !password || !confirm} onClick={() => void submitSignup()}>
                  {busy ? "Creating…" : "Create account"}
                </button>
                <button className="auth-ghost" type="button" onClick={() => reset("signup1")}>← Back</button>
              </>
            )}

            {/* ---- forgot password ---- */}
            {view === "forgot" && (
              <>
                <div className="auth-h">Reset your password</div>
                <p className="auth-sub">Enter your email and we&apos;ll send a link to set a new password.</p>
                <input className="auth-field" type="email" inputMode="email" autoComplete="email" placeholder="you@company.com"
                  value={email} onChange={(e) => { setEmail(e.target.value); error && setError(null); }}
                  onKeyDown={(e) => e.key === "Enter" && validEmail && void submitForgot()} />
                {error && <div className="auth-err">{error}</div>}
                <button className="auth-email" type="button" disabled={!validEmail || busy} onClick={() => void submitForgot()}>
                  {busy ? "Sending…" : "Send reset link"}
                </button>
                <button className="auth-ghost" type="button" onClick={() => reset("signin")}>← Back to sign in</button>
              </>
            )}

            <div className="auth-legal" style={{ display: view === "pending" || view === "forgotSent" ? "none" : undefined }}>
              By continuing you agree to the Terms &amp; Privacy.
            </div>
          </div>
        </div>
      )}
    </>
  );
}
