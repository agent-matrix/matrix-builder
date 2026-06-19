// Optional Internal AI configuration (OllaBridge), stored per-browser.
//
// This is an *assist-only* setting. It never changes the deterministic Matrix contract — it only
// lets an optional internal assistant improve display copy and explanations. Provider defaults to
// "none", so a fresh browser makes zero AI calls and the app stays fully deterministic.
//
// Adapted from the AI provider settings shape in ruslanmv/3D-Avatar-Chatbot (LLMManager.js),
// reduced to the two providers Matrix Builder supports today: none and OllaBridge.

export type AIProvider = "none" | "ollabridge";

// "deterministic" = assist OFF (today's behavior). "assisted" = internal AI may improve copy.
export type AIMode = "deterministic" | "assisted";

export type OllaBridgeAuthMode = "pairing" | "api_key" | "local-trust";

export type OllaBridgeSettings = {
  authMode: OllaBridgeAuthMode;
  baseUrl: string; // root only, no /v1
  model: string;
  apiKey: string; // never displayed back in plain text after save
  pairToken: string; // never displayed; used as Bearer for pairing mode
  deviceId: string;
};

// Optional enhancement: the "design brain". When enabled AND Internal AI (OllaBridge) assist is on,
// Matrix Builder uses the AI to design the full batch plan + the coder prompts for the next stages.
// Default OFF — it never changes the deterministic Matrix contract.
export type MatrixDesignerSettings = {
  enabled: boolean;
};

export type MatrixAISettings = {
  provider: AIProvider;
  mode: AIMode;
  ollabridge: OllaBridgeSettings;
  matrixDesigner: MatrixDesignerSettings;
};

export const AI_SETTINGS_STORAGE_KEY = "matrix-builder:ai-settings:v1";

export const OLLABRIDGE_DEFAULT_BASE_URL = "https://app.ollabridge.com";
export const OLLABRIDGE_DEFAULT_MODEL = "qwen2.5:1.5b";

export const DEFAULT_AI_SETTINGS: MatrixAISettings = {
  provider: "none",
  mode: "deterministic",
  ollabridge: {
    authMode: "pairing",
    baseUrl: OLLABRIDGE_DEFAULT_BASE_URL,
    model: OLLABRIDGE_DEFAULT_MODEL,
    apiKey: "",
    pairToken: "",
    deviceId: "",
  },
  matrixDesigner: {
    enabled: false,
  },
};
