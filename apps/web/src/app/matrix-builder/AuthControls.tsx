"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { apiBaseUrl } from "@/lib/api-client";
import { AUTH_EVENT, authHeaders, clearSession, getAuthToken, getUser, setSession, type AuthUser } from "@/lib/auth-token";
import { clearAISettings } from "@/lib/ai-settings-store";
import AiConfigurationSection from "@/components/settings/AiConfigurationSection";

// Render modal overlays at <body> so their position:fixed is relative to the viewport.
// The Matrix Builder header (.mb-detail-bar) uses backdrop-filter, which makes it the containing
// block for fixed descendants — without this portal the modal would center on the header box, not
// the screen (the reported "modal not centered" bug). SSR-safe via the mounted guard.
function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

const ENV_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const GIS_SRC = "https://accounts.google.com/gsi/client";
const EMAIL_RE = /\S+@\S+\.\S+/;
const AUTH_ERROR_EVENT = "mb-auth-error";

type View = "signin" | "signup" | "verify" | "forgot" | "forgotSent" | "success";

// ---- icons ---------------------------------------------------------------------------------
const I = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 6 8.5-6" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>,
  user: <><circle cx="12" cy="8" r="3.5" /><path d="M5 19.5c1.4-3.4 4-5 7-5s5.6 1.6 7 5" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 10.6a3 3 0 004.2 4.2" /><path d="M9.4 5.6A9.6 9.6 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 01-3 3.6M6.2 6.8A16 16 0 002.5 12S6 18.5 12 18.5c.9 0 1.7-.1 2.5-.3" /></>,
  check: <path d="M5 13l4 4 10-11" />,
  mailBig: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 6 8.5-6" /></>,
  cube: <><path d="M12 2.7l8 4.6v9.4l-8 4.6-8-4.6V7.3z" /><path d="M4 7.3l8 4.7 8-4.7M12 12v8.6" /></>,
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M19.4 13.5a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.9-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00-1.2-2.9H3a2 2 0 110-4h.1A1.7 1.7 0 004.3 7l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.6V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.6 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>,
  logout: <><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
};
function Ic({ d, size = 18, sw = 1.7 }: { d: ReactNode; size?: number; sw?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
}

// ---- Google Identity Services (loaded + initialised once, globally) ------------------------
let gisPromise: Promise<void> | null = null;
let gisInitFor: string | null = null;
function loadGis(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!gisPromise) {
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = GIS_SRC; s.async = true; s.defer = true;
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
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ credential: resp.credential }),
    });
    if (!res.ok) throw new Error(`auth ${res.status}`);
    const data = (await res.json()) as { access_token: string; user?: AuthUser };
    setSession(data.access_token, data.user ?? {}); // broadcasts AUTH_EVENT
  } catch {
    window.dispatchEvent(new CustomEvent(AUTH_ERROR_EVENT, { detail: "Google sign-in failed. Please try again." }));
  }
}
function ensureGoogleInit(clientId: string): void {
  if (gisInitFor === clientId || !window.google?.accounts?.id) return;
  window.google.accounts.id.initialize({ client_id: clientId, callback: onGoogleCredential, cancel_on_tap_outside: true });
  gisInitFor = clientId;
}

type GisId = {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; cancel_on_tap_outside?: boolean }) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
};
declare global { interface Window { google?: { accounts: { id: GisId } } } }

function initials(u: AuthUser): string {
  return (u.name || u.email || "U").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("");
}
async function detail(res: Response, fallback: string): Promise<string> {
  try { const d = await res.json(); if (typeof d?.detail === "string") return d.detail; } catch { /**/ }
  return fallback;
}

// ---- small presentational helpers ----------------------------------------------------------
function AuthField({ icon, value, onChange, onEnter, type = "text", placeholder, autoComplete, autoFocus }: {
  icon: ReactNode; value: string; onChange: (v: string) => void; onEnter?: () => void;
  type?: string; placeholder: string; autoComplete?: string; autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <label className="auth-input">
      <span className="auth-input-ic"><Ic d={icon} size={17} /></span>
      <input
        className="auth-field" type={isPw && show ? "text" : type} placeholder={placeholder}
        autoComplete={autoComplete} autoFocus={autoFocus} value={value} inputMode={type === "email" ? "email" : undefined}
        onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
      />
      {isPw && (
        <button type="button" className="auth-eye" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((s) => !s)}>
          <Ic d={show ? I.eyeOff : I.eye} size={17} />
        </button>
      )}
    </label>
  );
}
const Divider = () => <div className="auth-or">or</div>;
const ErrorMsg = ({ msg }: { msg: string | null }) => (msg ? <div className="auth-err" role="alert">{msg}</div> : null);

export default function AuthControls({ onNotice }: { onNotice?: (m: string) => void }) {
  const [user, setLocalUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(ENV_CLIENT_ID);
  const [view, setView] = useState<View>("signin");
  const [successKind, setSuccessKind] = useState<"welcome" | "created">("welcome");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [delText, setDelText] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [pwCur, setPwCur] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConf, setPwConf] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const btnRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const validEmail = EMAIL_RE.test(email.trim());
  const showGoogle = Boolean(clientId);

  useEffect(() => {
    const refresh = () => setLocalUser(getUser());
    refresh();
    const onErr = (e: Event) => { setBusy(false); setError((e as CustomEvent).detail || "Sign-in failed."); };
    const onChange = () => { setLocalUser(getUser()); if (getUser()) { setSuccessKind("welcome"); setView("success"); setTimeout(() => setOpen(false), 1300); } };
    window.addEventListener(AUTH_EVENT, onChange);
    window.addEventListener("storage", refresh);
    window.addEventListener(AUTH_ERROR_EVENT, onErr);
    if (!ENV_CLIENT_ID) {
      fetch(`${apiBaseUrl}/api/v1/auth/status`).then((r) => (r.ok ? r.json() : null))
        .then((d: { google_client_id?: string } | null) => d?.google_client_id && setClientId(d.google_client_id)).catch(() => {});
    }
    return () => { window.removeEventListener(AUTH_EVENT, onChange); window.removeEventListener("storage", refresh); window.removeEventListener(AUTH_ERROR_EVENT, onErr); };
  }, []);

  const googleViews = view === "signin" || view === "signup";
  useEffect(() => {
    if (!open || !showGoogle || !googleViews) return;
    let cancelled = false;
    loadGis().then(() => {
      if (cancelled || !window.google || !btnRef.current) return;
      ensureGoogleInit(clientId);
      btnRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(btnRef.current, { theme: "filled_black", size: "large", shape: "pill", text: view === "signup" ? "signup_with" : "continue_with", logo_alignment: "left", width: 340 });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [open, showGoogle, googleViews, view, clientId]);

  function go(next: View) { setError(null); setBusy(false); setView(next); }
  function openModal() { setEmail(""); setName(""); setPassword(""); setConfirm(""); setAgree(false); go("signin"); setOpen(true); }

  async function submitLogin() {
    if (busy) return; setBusy(true); setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase(), password }) });
      if (!res.ok) throw new Error(await detail(res, "Incorrect email or password."));
      const data = (await res.json()) as { access_token: string; user?: AuthUser };
      setSession(data.access_token, data.user ?? {}); // → AUTH_EVENT → success screen
    } catch (e) { setError(e instanceof Error ? e.message : "Sign in failed."); setBusy(false); }
  }
  async function submitSignup() {
    if (busy) return;
    if (!agree) return setError("Please accept the Terms & Privacy Policy.");
    if (password.length < 8) return setError("Use a password of at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/signup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase(), password, name: name.trim() || null, origin: window.location.origin }) });
      if (res.status === 409) { setError("An account with this email already exists — sign in instead."); go("signin"); return; }
      if (!res.ok) throw new Error(await detail(res, "Couldn't create your account."));
      const data = (await res.json()) as { email_sent?: boolean };
      if (data.email_sent === false) { setError("We couldn't send the verification email right now. Please try again."); return; }
      go("verify");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't create your account."); }
    finally { setBusy(false); }
  }
  async function resendActivation() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/signup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase(), password, name: name.trim() || null, origin: window.location.origin }) });
      if (!res.ok && res.status !== 409) throw new Error(await detail(res, "Couldn't resend."));
      onNotice?.("Verification email re-sent.");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't resend."); }
    finally { setBusy(false); }
  }
  async function submitForgot() {
    if (busy) return; setBusy(true); setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/password/forgot`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase(), origin: window.location.origin }) });
      if (!res.ok && res.status !== 200) throw new Error(await detail(res, "Couldn't send the reset link."));
      go("forgotSent");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't send the reset link."); }
    finally { setBusy(false); }
  }

  async function deleteAccount() {
    if (delBusy) return;
    setDelBusy(true); setDelError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/account`, { method: "DELETE", headers: { ...authHeaders() } });
      if (!res.ok) throw new Error(await detail(res, "Couldn't delete your account. Please try again."));
      clearSession();
      clearAISettings(); // browser-local AI provider settings are part of "your data"
      setConfirmDelete(false); setMenuOpen(false); setDelText("");
      onNotice?.("Your account and data have been deleted.");
    } catch (e) { setDelError(e instanceof Error ? e.message : "Delete failed."); }
    finally { setDelBusy(false); }
  }

  async function saveName() {
    if (savingName) return;
    setSavingName(true); setSettingsMsg(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/account`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: settingsName.trim() || null }),
      });
      if (!res.ok) throw new Error(await detail(res, "Couldn't save."));
      const data = (await res.json()) as AuthUser;
      const token = getAuthToken();
      if (token) setSession(token, { ...(getUser() ?? {}), name: data.name ?? null });
      setSettingsMsg("Saved.");
    } catch (e) { setSettingsMsg(e instanceof Error ? e.message : "Couldn't save."); }
    finally { setSavingName(false); }
  }

  async function savePassword() {
    if (pwBusy) return;
    if (pwNew.length < 8) return setPwMsg("Use a new password of at least 8 characters.");
    if (pwNew !== pwConf) return setPwMsg("New passwords don't match.");
    setPwBusy(true); setPwMsg(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/auth/password/change`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeaders() },
        body: JSON.stringify({ current_password: pwCur, new_password: pwNew }),
      });
      if (!res.ok) throw new Error(await detail(res, "Couldn't change password."));
      setPwCur(""); setPwNew(""); setPwConf("");
      setPwMsg("Password updated.");
    } catch (e) { setPwMsg(e instanceof Error ? e.message : "Couldn't change password."); }
    finally { setPwBusy(false); }
  }

  if (user && !open) {
    const label = user.name || user.email || "Account";
    return (
      <span className="mb-usermenu">
        <button type="button" className="mb-userbtn" onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu" aria-expanded={menuOpen}>
          <span className="mb-avatar">{initials(user)}</span>
        </button>
        {menuOpen && (
          <>
            <div className="mb-menu-scrim" onClick={() => setMenuOpen(false)} />
            <div className="mb-menu" role="menu">
              <div className="mb-menu-id">
                <span className="mb-menu-name">{label}</span>
                {user.email ? <span className="mb-menu-email">{user.email}</span> : null}
              </div>
              <button type="button" className="mb-menu-item" onClick={() => { setMenuOpen(false); router.push("/matrix-builder/builds"); }}>
                <Ic d={I.cube} size={17} /> My Builds
              </button>
              <button type="button" className="mb-menu-item" onClick={() => { setMenuOpen(false); setSettingsName(user.name ?? ""); setSettingsMsg(null); setSettingsOpen(true); }}>
                <Ic d={I.gear} size={17} /> Settings
              </button>
              <div className="mb-menu-sep" />
              <button type="button" className="mb-menu-item danger" onClick={() => { setMenuOpen(false); clearSession(); onNotice?.("Signed out"); }}>
                <Ic d={I.logout} size={17} /> Sign out
              </button>
            </div>
          </>
        )}

        {settingsOpen && (
          <Portal>
          <div className="auth-scrim" role="dialog" aria-modal="true" aria-label="Settings" onMouseDown={(e) => { if (e.target === e.currentTarget) setSettingsOpen(false); }}>
            <div className="settings-card">
              <button className="auth-x" type="button" aria-label="Close" onClick={() => setSettingsOpen(false)}><Ic d={<path d="M6 6l12 12M18 6L6 18" />} size={16} /></button>

              <div className="settings-head">
                <div>
                  <p className="settings-eyebrow">Account</p>
                  <h2 className="settings-title">Settings</h2>
                  <p className="settings-subtitle">Manage your profile and account preferences.</p>
                </div>
                <div className="settings-avatar">{initials(user)}</div>
              </div>

              {/* Profile */}
              <section className="settings-section">
                <div className="settings-section-head"><h3>Profile</h3><p>Your public account information.</p></div>
                <div className="settings-row">
                  <div><div className="settings-label">Email address</div><div className="settings-value">{user.email}</div></div>
                  <span className="settings-badge">Verified</span>
                </div>
                <div className="settings-field-group">
                  <label className="settings-label" htmlFor="settings-display-name">Display name</label>
                  <div className="settings-input-wrap">
                    <span className="settings-input-icon"><Ic d={I.user} size={17} /></span>
                    <input id="settings-display-name" className="settings-input" value={settingsName} placeholder="Your name"
                      onChange={(e) => { setSettingsName(e.target.value); setSettingsMsg(null); }}
                      onKeyDown={(e) => e.key === "Enter" && saveName()} />
                  </div>
                </div>
                {settingsMsg && <div className={settingsMsg === "Saved." ? "settings-success" : "auth-err"}>{settingsMsg}</div>}
                <div className="settings-actions">
                  <button className="settings-primary" type="button" disabled={savingName} onClick={saveName}>{savingName ? "Saving…" : "Save changes"}</button>
                </div>
              </section>

              {/* Security — change password */}
              <section className="settings-section">
                <div className="settings-section-head"><h3>Security</h3><p>Change your password. (Google accounts use “Forgot password” to set one.)</p></div>
                <div className="settings-field-group">
                  <label className="settings-label" htmlFor="pw-cur">Current password</label>
                  <div className="settings-input-wrap"><span className="settings-input-icon"><Ic d={I.lock} size={17} /></span>
                    <input id="pw-cur" className="settings-input" type="password" autoComplete="current-password" value={pwCur} onChange={(e) => { setPwCur(e.target.value); setPwMsg(null); }} /></div>
                </div>
                <div className="settings-field-group">
                  <label className="settings-label" htmlFor="pw-new">New password</label>
                  <div className="settings-input-wrap"><span className="settings-input-icon"><Ic d={I.lock} size={17} /></span>
                    <input id="pw-new" className="settings-input" type="password" autoComplete="new-password" placeholder="min 8 characters" value={pwNew} onChange={(e) => { setPwNew(e.target.value); setPwMsg(null); }} /></div>
                </div>
                <div className="settings-field-group">
                  <label className="settings-label" htmlFor="pw-conf">Confirm new password</label>
                  <div className="settings-input-wrap"><span className="settings-input-icon"><Ic d={I.lock} size={17} /></span>
                    <input id="pw-conf" className="settings-input" type="password" autoComplete="new-password" value={pwConf} onChange={(e) => { setPwConf(e.target.value); setPwMsg(null); }} onKeyDown={(e) => e.key === "Enter" && savePassword()} /></div>
                </div>
                {pwMsg && <div className={pwMsg === "Password updated." ? "settings-success" : "auth-err"}>{pwMsg}</div>}
                <div className="settings-actions">
                  <button className="settings-primary" type="button" disabled={pwBusy || !pwCur || !pwNew || !pwConf} onClick={savePassword}>{pwBusy ? "Updating…" : "Update password"}</button>
                </div>
              </section>

              {/* Account access */}
              <section className="settings-section">
                <div className="settings-section-head"><h3>Account access</h3><p>Review how you access Matrix Builder.</p></div>
                <div className="settings-row">
                  <div><div className="settings-label">Sign-in method</div><div className="settings-value">Email or Google account</div></div>
                  <span className="settings-badge muted">Active</span>
                </div>
              </section>

              {/* System Configuration — optional Internal AI (OllaBridge) */}
              <AiConfigurationSection />

              {/* Danger zone */}
              <section className="settings-danger-zone">
                <div>
                  <div className="settings-danger-eyebrow">Danger zone</div>
                  <h3>Delete account</h3>
                  <p>Permanently delete your account, builds, bundles, and validation history. This action cannot be undone.</p>
                </div>
                <button className="settings-danger-button" type="button" onClick={() => { setSettingsOpen(false); setDelText(""); setDelError(null); setConfirmDelete(true); }}>Delete account</button>
              </section>
            </div>
          </div>
          </Portal>
        )}

        {confirmDelete && (
          <Portal>
          <div className="auth-scrim" role="dialog" aria-modal="true" aria-label="Delete account" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmDelete(false); }}>
            <div className="auth-card">
              <button className="auth-x" type="button" aria-label="Close" onClick={() => setConfirmDelete(false)}><Ic d={<path d="M6 6l12 12M18 6L6 18" />} size={16} /></button>
              <div className="auth-mark auth-mark-danger">!</div>
              <h2 className="auth-h">Delete account</h2>
              <p className="auth-sub">This permanently deletes your account and <strong style={{ color: "#f7fff9" }}>all your data</strong> (builds, bundles, validations). This cannot be undone.</p>
              <p className="auth-sub" style={{ marginTop: -8 }}>Type your email <strong style={{ color: "#f7fff9" }}>{user.email}</strong> to confirm:</p>
              <AuthField icon={I.mail} type="email" placeholder="your email" value={delText} onChange={(v) => { setDelText(v); delError && setDelError(null); }} onEnter={deleteAccount} autoFocus />
              <ErrorMsg msg={delError} />
              <button className="auth-danger" type="button" disabled={delBusy || delText.trim().toLowerCase() !== (user.email ?? "").toLowerCase()} onClick={deleteAccount}>{delBusy ? "Deleting…" : "Delete my account"}</button>
              <button className="auth-ghost" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          </div>
          </Portal>
        )}
      </span>
    );
  }

  const GoogleSlot = showGoogle ? <><div className="auth-gshell"><div ref={btnRef} /></div><Divider /></> : null;
  const legal = <div className="auth-legal">By continuing, you agree to our <a className="auth-link" href="/terms" target="_blank" rel="noreferrer">Terms</a> &amp; <a className="auth-link" href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.</div>;

  return (
    <>
      <button className="l-signin" type="button" onClick={openModal}>Sign in</button>
      {open && (
        <Portal>
        <div className="auth-scrim" role="dialog" aria-modal="true" aria-label="Account" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="auth-card">
            <button className="auth-x" type="button" aria-label="Close" onClick={() => setOpen(false)}><Ic d={<path d="M6 6l12 12M18 6L6 18" />} size={16} /></button>
            <div className="auth-mark">◇</div>

            {view === "signin" && (
              <>
                <h2 className="auth-h">Welcome back</h2>
                <p className="auth-sub">Sign in to your Matrix Builder account</p>
                {GoogleSlot}
                <AuthField icon={I.mail} type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(v) => { setEmail(v); error && setError(null); }} autoFocus />
                <AuthField icon={I.lock} type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(v) => { setPassword(v); error && setError(null); }} onEnter={submitLogin} />
                <div className="auth-secondary"><button type="button" className="auth-link" onClick={() => go("forgot")}>Forgot password?</button></div>
                <ErrorMsg msg={error} />
                <button className="auth-email" type="button" disabled={!validEmail || !password || busy} onClick={submitLogin}>{busy ? "Signing in…" : "Sign in"}</button>
                <div className="auth-foot">Don&apos;t have an account? <button type="button" className="auth-link" onClick={() => go("signup")}>Create account</button></div>
                {legal}
              </>
            )}

            {view === "signup" && (
              <>
                <h2 className="auth-h">Create account</h2>
                <p className="auth-sub">Start building with Matrix Builder</p>
                {GoogleSlot}
                <AuthField icon={I.user} type="text" autoComplete="name" placeholder="Full name (optional)" value={name} onChange={setName} />
                <AuthField icon={I.mail} type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(v) => { setEmail(v); error && setError(null); }} />
                <AuthField icon={I.lock} type="password" autoComplete="new-password" placeholder="Password (min 8 characters)" value={password} onChange={(v) => { setPassword(v); error && setError(null); }} />
                <AuthField icon={I.lock} type="password" autoComplete="new-password" placeholder="Confirm password" value={confirm} onChange={(v) => { setConfirm(v); error && setError(null); }} onEnter={submitSignup} />
                <label className="auth-check">
                  <input type="checkbox" checked={agree} onChange={(e) => { setAgree(e.target.checked); error && setError(null); }} />
                  <span>I agree to the <a className="auth-link" href="/terms" target="_blank" rel="noreferrer">Terms</a> &amp; <a className="auth-link" href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a></span>
                </label>
                <ErrorMsg msg={error} />
                <button className="auth-email" type="button" disabled={busy || !validEmail || !password || !confirm} onClick={submitSignup}>{busy ? "Creating…" : "Create account"}</button>
                <div className="auth-foot">Already have an account? <button type="button" className="auth-link" onClick={() => go("signin")}>Sign in</button></div>
              </>
            )}

            {view === "verify" && (
              <div className="auth-center">
                <div className="auth-bigic"><Ic d={I.mailBig} size={30} /></div>
                <h2 className="auth-h">Verify your email</h2>
                <p className="auth-sub">We&apos;ve sent a verification link to<br /><strong style={{ color: "#f7fff9" }}>{email.trim().toLowerCase()}</strong>. Click it to activate your account.</p>
                <ErrorMsg msg={error} />
                <button className="auth-email" type="button" disabled={busy} onClick={resendActivation}>{busy ? "Sending…" : "Resend email"}</button>
                <div className="auth-foot">
                  <button type="button" className="auth-link" onClick={() => go("signup")}>Change email</button>
                  <span> · </span>
                  <button type="button" className="auth-link" onClick={() => go("signin")}>Back to sign in</button>
                </div>
              </div>
            )}

            {view === "forgot" && (
              <>
                <button className="auth-topback" type="button" onClick={() => go("signin")}><Ic d={<path d="M14 6l-6 6 6 6" />} size={15} /> Back to sign in</button>
                <h2 className="auth-h">Reset password</h2>
                <p className="auth-sub">Enter your email and we&apos;ll send you a reset link.</p>
                <AuthField icon={I.mail} type="email" autoComplete="email" placeholder="Email address" value={email} onChange={(v) => { setEmail(v); error && setError(null); }} onEnter={submitForgot} autoFocus />
                <ErrorMsg msg={error} />
                <button className="auth-email" type="button" disabled={!validEmail || busy} onClick={submitForgot}>{busy ? "Sending…" : "Send reset link"}</button>
              </>
            )}

            {view === "forgotSent" && (
              <div className="auth-center">
                <div className="auth-bigic auth-bigic-ok"><Ic d={I.check} size={30} sw={2.2} /></div>
                <h2 className="auth-h">Check your email</h2>
                <p className="auth-sub">We&apos;ve sent a link to reset your password.</p>
                <button className="auth-ghost" type="button" onClick={() => go("signin")}>Back to sign in</button>
              </div>
            )}

            {view === "success" && (
              <div className="auth-center">
                <div className="auth-bigic auth-bigic-ok"><Ic d={I.check} size={30} sw={2.2} /></div>
                <h2 className="auth-h">{successKind === "created" ? "Account created!" : "Welcome back!"}</h2>
                <p className="auth-sub">Redirecting…</p>
              </div>
            )}
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}
