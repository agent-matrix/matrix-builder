// OpenAI-compatible OllaBridge client, adapted from ruslanmv/3D-Avatar-Chatbot (src/LLMManager.js).
//
// Only the AI-provider connection pattern is adapted: pairing, model listing, and chat against an
// OpenAI-compatible endpoint. Nothing here writes to the Matrix contract; callers use it for
// optional internal assist only. All functions are safe to call from the browser.

import type { OllaBridgeSettings } from "@/types/ai-settings";

export type PairResult = { pairToken: string; deviceId: string };
export type ModelResult = { models: string[]; selected: string };
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// --- Pure helpers (unit-tested) ------------------------------------------------------------

export function stripTrailingSlash(url: string): string {
  return String(url || "").replace(/\/+$/, "");
}

// The base URL is the OllaBridge root; we append /v1/... ourselves. A value ending in /v1 would
// produce /v1/v1/... so we reject it early with a clear message.
export function assertRootBaseUrl(baseUrl: string): void {
  const root = stripTrailingSlash(baseUrl);
  if (!root) throw new Error("Base URL is required.");
  if (/\/v1$/i.test(root)) {
    throw new Error("Enter the root URL only (no /v1). Example: https://app.ollabridge.com");
  }
}

// OllaBridge pairing codes are shown grouped/hyphenated (e.g. "OJQW-5764"); normalize before send.
export function normalizePairingCode(code: string): string {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/-/g, "")
    .replace(/\s+/g, "");
}

export function isLocalhostLike(baseUrl: string): boolean {
  const root = stripTrailingSlash(baseUrl);
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(root);
}

export function chatUrl(baseUrl: string): string {
  return `${stripTrailingSlash(baseUrl)}/v1/chat/completions`;
}
export function modelsUrl(baseUrl: string): string {
  return `${stripTrailingSlash(baseUrl)}/v1/models`;
}
export function pairingUrl(baseUrl: string): string {
  return `${stripTrailingSlash(baseUrl)}/pair`;
}

// Build the Authorization header for the selected auth mode. Local-trust sends none by design.
export function authHeader(settings: OllaBridgeSettings): Record<string, string> {
  if (settings.authMode === "pairing" && settings.pairToken) {
    return { Authorization: `Bearer ${settings.pairToken}` };
  }
  if (settings.authMode === "api_key" && settings.apiKey) {
    return { Authorization: `Bearer ${settings.apiKey}` };
  }
  return {};
}

// --- Network calls -------------------------------------------------------------------------

export async function pairWithOllaBridge(
  settings: OllaBridgeSettings,
  code: string,
): Promise<PairResult> {
  assertRootBaseUrl(settings.baseUrl);
  const cleanCode = normalizePairingCode(code);
  if (!cleanCode) throw new Error("Enter a pairing code.");
  const res = await fetch(pairingUrl(settings.baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: cleanCode, label: "matrix-builder" }),
  });
  if (!res.ok) {
    throw new Error(`Pairing failed (${res.status}). Check the code and try again.`);
  }
  const data = (await res.json().catch(() => ({}))) as {
    token?: string;
    pair_token?: string;
    device_id?: string;
    deviceId?: string;
  };
  const pairToken = data.token ?? data.pair_token ?? "";
  if (!pairToken) throw new Error("Pairing succeeded but no token was returned.");
  return { pairToken, deviceId: data.device_id ?? data.deviceId ?? "" };
}

export async function fetchOllaBridgeModels(settings: OllaBridgeSettings): Promise<ModelResult> {
  assertRootBaseUrl(settings.baseUrl);
  const res = await fetch(modelsUrl(settings.baseUrl), {
    headers: { ...authHeader(settings) },
  });
  if (!res.ok) throw new Error(`Could not fetch models (${res.status}).`);
  const data = (await res.json().catch(() => ({}))) as { data?: Array<{ id?: string }> };
  const models = (data.data ?? []).map((m) => m.id).filter((id): id is string => Boolean(id));
  // Keep the current model if still offered; else prefer the default; else the first returned.
  const selected = models.includes(settings.model)
    ? settings.model
    : models.includes("qwen2.5:1.5b")
      ? "qwen2.5:1.5b"
      : (models[0] ?? settings.model);
  return { models, selected };
}

export async function sendOllaBridgeChat(
  settings: OllaBridgeSettings,
  messages: ChatMessage[],
): Promise<string> {
  assertRootBaseUrl(settings.baseUrl);
  const res = await fetch(chatUrl(settings.baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(settings) },
    body: JSON.stringify({ model: settings.model, messages }),
  });
  if (!res.ok) throw new Error(`AI request failed (${res.status}).`);
  const data = (await res.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}
