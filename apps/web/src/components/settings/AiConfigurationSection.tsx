"use client";

// System Configuration → AI Provider section for the Account Settings modal.
//
// Optional Internal AI (OllaBridge) only. Adapted from the System Configuration UI in
// ruslanmv/3D-Avatar-Chatbot (index.html): provider selector, Device Pairing / API Key / Local
// Trust modes, Base URL, Model, Fetch Models. Everything is browser-local and assist-only; the
// deterministic Matrix contract is never affected by anything chosen here.

import { useEffect, useState } from "react";
import { getAISettings, saveAISettings } from "@/lib/ai-settings-store";
import { getDefaultCoder, setDefaultCoder } from "@/lib/default-coder-store";
import { AI_CODERS } from "@/lib/constants";
import type { CoderId } from "@/types/coder";
import {
  assertRootBaseUrl,
  fetchOllaBridgeModels,
  isLocalhostLike,
  pairWithOllaBridge,
  stripTrailingSlash,
} from "@/lib/ollabridge-client";
import {
  DEFAULT_AI_SETTINGS,
  type AIProvider,
  type MatrixAISettings,
  type OllaBridgeAuthMode,
} from "@/types/ai-settings";

type Note = { kind: "ok" | "err" | "info"; text: string } | null;

export default function AiConfigurationSection() {
  const [settings, setSettings] = useState<MatrixAISettings>(DEFAULT_AI_SETTINGS);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [hasPairToken, setHasPairToken] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [pairCode, setPairCode] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [pairing, setPairing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [pairNote, setPairNote] = useState<Note>(null);
  const [modelNote, setModelNote] = useState<Note>(null);
  const [saveNote, setSaveNote] = useState<Note>(null);
  // Default AI coder preference. "" = None (no override).
  const [defaultCoder, setDefaultCoderDraft] = useState<CoderId | "">("");

  useEffect(() => {
    const s = getAISettings();
    setSettings(s);
    setHasSavedKey(Boolean(s.ollabridge.apiKey));
    setHasPairToken(Boolean(s.ollabridge.pairToken));
    setDefaultCoderDraft(getDefaultCoder() ?? "");
  }, []);

  function onDefaultCoderChange(value: string) {
    const next = (value || null) as CoderId | null;
    setDefaultCoderDraft((next ?? "") as CoderId | "");
    setDefaultCoder(next);
  }

  // Optional Matrix Designer enhancement — persist immediately, like the default-coder preference.
  function onToggleMatrixDesigner(enabled: boolean) {
    setSettings((s) => {
      const next = { ...s, matrixDesigner: { ...s.matrixDesigner, enabled } };
      saveAISettings(next);
      return next;
    });
    setSaveNote(null);
  }

  const ob = settings.ollabridge;
  const localhost = isLocalhostLike(ob.baseUrl);

  function patchOb(patch: Partial<MatrixAISettings["ollabridge"]>) {
    setSettings((s) => ({ ...s, ollabridge: { ...s.ollabridge, ...patch } }));
    setSaveNote(null);
  }
  function setProvider(provider: AIProvider) {
    setSettings((s) => ({ ...s, provider, mode: provider === "none" ? "deterministic" : s.mode }));
    setSaveNote(null);
  }
  function setAuthMode(authMode: OllaBridgeAuthMode) {
    // Local Trust is only safe against a localhost OllaBridge; block it for remote URLs.
    if (authMode === "local-trust" && !localhost) {
      setPairNote({ kind: "err", text: "Local Trust is only allowed for localhost / 127.0.0.1 base URLs." });
      return;
    }
    patchOb({ authMode });
    setPairNote(null);
  }

  function persist(next: MatrixAISettings) {
    saveAISettings(next);
    setSettings(next);
    setHasSavedKey(Boolean(next.ollabridge.apiKey));
    setHasPairToken(Boolean(next.ollabridge.pairToken));
  }

  function onSave() {
    try {
      if (settings.provider === "ollabridge") assertRootBaseUrl(ob.baseUrl);
    } catch (e) {
      setSaveNote({ kind: "err", text: e instanceof Error ? e.message : "Invalid Base URL." });
      return;
    }
    const next: MatrixAISettings = {
      ...settings,
      ollabridge: {
        ...ob,
        baseUrl: stripTrailingSlash(ob.baseUrl),
        // Only overwrite the saved key if the user typed a new one; never echo it back.
        apiKey: apiKeyDraft ? apiKeyDraft : ob.apiKey,
      },
    };
    persist(next);
    setApiKeyDraft("");
    setSaveNote({ kind: "ok", text: "AI configuration saved." });
  }

  async function onPair() {
    setPairNote(null);
    try {
      assertRootBaseUrl(ob.baseUrl);
    } catch (e) {
      setPairNote({ kind: "err", text: e instanceof Error ? e.message : "Invalid Base URL." });
      return;
    }
    setPairing(true);
    try {
      const result = await pairWithOllaBridge(ob, pairCode);
      // Store the token (never displayed) and persist immediately so it isn't lost.
      const next: MatrixAISettings = {
        ...settings,
        ollabridge: { ...ob, pairToken: result.pairToken, deviceId: result.deviceId },
      };
      persist(next);
      setPairCode("");
      setPairNote({ kind: "ok", text: "Paired. This device is now connected to OllaBridge." });
    } catch (e) {
      // Keep any existing working token; only the attempt failed.
      setPairNote({ kind: "err", text: e instanceof Error ? e.message : "Pairing failed." });
    } finally {
      setPairing(false);
    }
  }

  async function onFetchModels() {
    setModelNote({ kind: "info", text: "Fetching…" });
    setFetching(true);
    try {
      const result = await fetchOllaBridgeModels(ob);
      setModels(result.models);
      patchOb({ model: result.selected });
      setModelNote({ kind: "ok", text: `Loaded ${result.models.length} model${result.models.length === 1 ? "" : "s"}.` });
    } catch {
      setModelNote({ kind: "err", text: "Could not fetch models. Check Base URL and authentication." });
    } finally {
      setFetching(false);
    }
  }

  const modelOptions = models.length > 0 ? models : [ob.model];

  return (
    <section className="settings-section">
      <div className="settings-section-head">
        <h3>System Configuration</h3>
        <p>Optional Internal AI assist. OllaBridge can improve explanations and candidate wording, but it cannot change the Matrix contract.</p>
      </div>

      {/* Default AI coder — which coder new builds preselect. None = no override. */}
      <div className="settings-field-group">
        <span className="settings-label">Default AI coder</span>
        <select className="settings-input" value={defaultCoder} onChange={(e) => onDefaultCoderChange(e.target.value)}>
          <option value="">None</option>
          {AI_CODERS.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <p className="settings-hint">New builds start on this coder. Default is None.</p>
      </div>

      {/* Provider */}
      <div className="settings-field-group">
        <span className="settings-label">AI Provider</span>
        <div className="ai-provider-row">
          <label className={`ai-radio${settings.provider === "ollabridge" ? " on" : ""}`}>
            <input type="radio" name="ai-provider" checked={settings.provider === "ollabridge"} onChange={() => setProvider("ollabridge")} />
            <span>🌉 OllaBridge</span>
          </label>
          <label className={`ai-radio${settings.provider === "none" ? " on" : ""}`}>
            <input type="radio" name="ai-provider" checked={settings.provider === "none"} onChange={() => setProvider("none")} />
            <span>None</span>
          </label>
        </div>
      </div>

      {settings.provider === "none" && (
        <p className="ai-help">AI assist is off. Matrix Builder will run deterministically.</p>
      )}

      {/* Optional enhancement: Matrix Designer — the design brain. Default OFF. */}
      <div className="ai-divider" />
      <div className="settings-field-group">
        <label className="ai-toggle md-toggle">
          <input
            type="checkbox"
            checked={settings.matrixDesigner.enabled}
            onChange={(e) => onToggleMatrixDesigner(e.target.checked)}
          />
          <span>
            🧠 Matrix Designer <span className="md-badge">optional</span>
            <em className="ai-toggle-hint">
              {settings.matrixDesigner.enabled
                ? settings.provider === "ollabridge" && settings.mode === "assisted"
                  ? "On — uses your Internal AI (OllaBridge) to design the full batch plan and coder prompts for the next stages. The Matrix contract is unchanged."
                  : "On — but it stays deterministic until Internal AI (OllaBridge) assist above is enabled; then it designs the batch plan with AI."
                : "Off — the design brain that plans every batch before you build. Turn on to inspect a full plan on each blueprint’s Details page."}
            </em>
          </span>
        </label>
      </div>

      {settings.provider === "ollabridge" && (
        <>
          {/* Assisted-mode toggle */}
          <label className="ai-toggle">
            <input
              type="checkbox"
              checked={settings.mode === "assisted"}
              onChange={(e) => { setSettings((s) => ({ ...s, mode: e.target.checked ? "assisted" : "deterministic" })); setSaveNote(null); }}
            />
            <span>
              Enable AI assist (assisted mode)
              <em className="ai-toggle-hint">
                {settings.mode === "assisted"
                  ? "Internal AI assist is on. Contract generation and validation remain deterministic."
                  : "Off — connection is configured but no AI calls are made."}
              </em>
            </span>
          </label>

          <div className="ai-divider" />
          <div className="settings-section-head"><h3 className="ai-sub-h">API Configuration</h3></div>

          {/* Auth mode */}
          <div className="settings-field-group">
            <label className="settings-label" htmlFor="ai-auth-mode">Authentication mode</label>
            <div className="settings-input-wrap">
              <select
                id="ai-auth-mode"
                className="settings-input ai-select"
                value={ob.authMode}
                onChange={(e) => setAuthMode(e.target.value as OllaBridgeAuthMode)}
              >
                <option value="pairing">Device Pairing</option>
                <option value="api_key">API Key</option>
                <option value="local-trust">Local Trust</option>
              </select>
            </div>
          </div>

          {/* Base URL */}
          <div className="settings-field-group">
            <label className="settings-label" htmlFor="ai-base-url">Base URL (root only, no /v1)</label>
            <div className="settings-input-wrap">
              <input
                id="ai-base-url"
                className="settings-input"
                value={ob.baseUrl}
                placeholder={DEFAULT_AI_SETTINGS.ollabridge.baseUrl}
                onChange={(e) => patchOb({ baseUrl: e.target.value })}
              />
            </div>
          </div>

          {/* Pairing */}
          {ob.authMode === "pairing" && (
            <div className="settings-field-group">
              <span className="settings-label">Device Pairing {hasPairToken && <span className="ai-inline-ok">• connected</span>}</span>
              <p className="ai-help">Enter the OllaBridge pairing code and click Pair.</p>
              <div className="ai-inline">
                <div className="settings-input-wrap ai-grow">
                  <input
                    className="settings-input"
                    value={pairCode}
                    placeholder="Enter pairing code..."
                    onChange={(e) => setPairCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onPair()}
                  />
                </div>
                <button className="settings-primary ai-btn" type="button" disabled={pairing || !pairCode.trim()} onClick={onPair}>
                  {pairing ? "Pairing…" : "Pair"}
                </button>
              </div>
            </div>
          )}

          {/* API Key */}
          {ob.authMode === "api_key" && (
            <div className="settings-field-group">
              <label className="settings-label" htmlFor="ai-api-key">API Key {hasSavedKey && <span className="ai-inline-ok">• saved</span>}</label>
              <div className="settings-input-wrap">
                <input
                  id="ai-api-key"
                  className="settings-input"
                  type="password"
                  autoComplete="off"
                  value={apiKeyDraft}
                  placeholder={hasSavedKey ? "•••••••• (saved)" : "Enter API key..."}
                  onChange={(e) => { setApiKeyDraft(e.target.value); setSaveNote(null); }}
                />
              </div>
            </div>
          )}

          {/* Local Trust */}
          {ob.authMode === "local-trust" && (
            <p className="ai-help ai-warn">
              Local Trust is intended only for trusted localhost/development OllaBridge instances. No Authorization header will be sent.
            </p>
          )}

          {pairNote && <div className={noteClass(pairNote)}>{pairNote.text}</div>}

          {/* Model */}
          <div className="settings-field-group">
            <label className="settings-label" htmlFor="ai-model">Model</label>
            <div className="ai-inline">
              <div className="settings-input-wrap ai-grow">
                <select
                  id="ai-model"
                  className="settings-input ai-select"
                  value={ob.model}
                  onChange={(e) => patchOb({ model: e.target.value })}
                >
                  {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <button className="settings-primary ai-btn ghost" type="button" disabled={fetching} onClick={onFetchModels}>
                {fetching ? "Fetching…" : "Fetch Models"}
              </button>
            </div>
            {modelNote && <div className={noteClass(modelNote)}>{modelNote.text}</div>}
          </div>

          {saveNote && <div className={noteClass(saveNote)}>{saveNote.text}</div>}
          <div className="settings-actions">
            <button className="settings-primary" type="button" onClick={onSave}>Save AI configuration</button>
          </div>
        </>
      )}
    </section>
  );
}

function noteClass(note: NonNullable<Note>): string {
  if (note.kind === "ok") return "settings-success";
  if (note.kind === "err") return "auth-err";
  return "ai-note-info";
}
