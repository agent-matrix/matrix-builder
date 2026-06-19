// Browser-local persistence for the optional Internal AI settings (see types/ai-settings.ts).
//
// Stored separately from account/profile settings and from the auth token — these values never
// go to the Matrix Builder backend. Reads are defensive: malformed or partial JSON always falls
// back to defaults so the settings panel and the assist hooks can never throw during render.
//
// Phase 3 (cloud persistence) is intentionally deferred, so this lives only in localStorage.

import {
  AI_SETTINGS_STORAGE_KEY,
  DEFAULT_AI_SETTINGS,
  type MatrixAISettings,
} from "@/types/ai-settings";

// Merge whatever we read against defaults so missing/extra fields never break callers.
export function mergeAISettings(raw: unknown): MatrixAISettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_AI_SETTINGS };
  const r = raw as Partial<MatrixAISettings> & { ollabridge?: Record<string, unknown> };
  const ob = (r.ollabridge ?? {}) as Record<string, unknown>;
  const d = DEFAULT_AI_SETTINGS;
  const provider = r.provider === "ollabridge" ? "ollabridge" : "none";
  const mode = r.mode === "assisted" ? "assisted" : "deterministic";
  const authMode =
    ob.authMode === "api_key" || ob.authMode === "local-trust" ? ob.authMode : "pairing";
  const md = (r.matrixDesigner ?? {}) as Record<string, unknown>;
  return {
    provider,
    mode,
    ollabridge: {
      authMode,
      baseUrl: typeof ob.baseUrl === "string" && ob.baseUrl ? ob.baseUrl : d.ollabridge.baseUrl,
      model: typeof ob.model === "string" && ob.model ? ob.model : d.ollabridge.model,
      apiKey: typeof ob.apiKey === "string" ? ob.apiKey : "",
      pairToken: typeof ob.pairToken === "string" ? ob.pairToken : "",
      deviceId: typeof ob.deviceId === "string" ? ob.deviceId : "",
    },
    matrixDesigner: {
      enabled: md.enabled === true,
    },
  };
}

// Convenience: is the optional Matrix Designer enhancement turned on?
export function isMatrixDesignerEnabled(): boolean {
  return getAISettings().matrixDesigner.enabled;
}

export function getAISettings(): MatrixAISettings {
  if (typeof window === "undefined") return { ...DEFAULT_AI_SETTINGS };
  const raw = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
  if (!raw) return { ...DEFAULT_AI_SETTINGS };
  try {
    return mergeAISettings(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_AI_SETTINGS };
  }
}

export const AI_SETTINGS_EVENT = "mb-ai-settings-changed";

export function saveAISettings(settings: MatrixAISettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event(AI_SETTINGS_EVENT));
}

export function clearAISettings(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AI_SETTINGS_STORAGE_KEY);
  window.dispatchEvent(new Event(AI_SETTINGS_EVENT));
}
