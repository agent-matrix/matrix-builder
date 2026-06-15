// Unit tests for the optional Internal AI (OllaBridge) settings + client + manager.
//
// Run with: npm run test  (node --test with type-stripping and the @/ alias resolver).
// These cover the contract-safety guarantees: provider "none" makes zero AI calls, settings are
// browser-local and merge-safe, URLs/codes are normalized, and AI enrichment can only ever touch
// display copy — never the deterministic candidate fields that drive bundle generation.

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  DEFAULT_AI_SETTINGS,
  type MatrixAISettings,
  type OllaBridgeSettings,
} from "@/types/ai-settings";
import { getAISettings, saveAISettings, clearAISettings, mergeAISettings } from "@/lib/ai-settings-store";
import {
  assertRootBaseUrl,
  authHeader,
  chatUrl,
  fetchOllaBridgeModels,
  isLocalhostLike,
  modelsUrl,
  normalizePairingCode,
  pairWithOllaBridge,
  pairingUrl,
  sendOllaBridgeChat,
  stripTrailingSlash,
} from "@/lib/ollabridge-client";
import {
  briefToIdea,
  enhanceProjectBrief,
  enrichBlueprintCandidates,
  explainValidationFindings,
  isAssistEnabled,
  isOllaBridgeAssistAvailable,
  sanitizeBrief,
  sanitizeEnrichment,
} from "@/lib/ai-provider-manager";
import type { ProjectBriefContract } from "@/lib/workflow-types";

// --- A tiny window/localStorage shim so the store + manager run under node --test --------------

function installFakeWindow(): Map<string, string> {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
    },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  return store;
}

function setSettings(patch: Partial<MatrixAISettings>, ob: Partial<OllaBridgeSettings> = {}) {
  saveAISettings({
    ...DEFAULT_AI_SETTINGS,
    ...patch,
    ollabridge: { ...DEFAULT_AI_SETTINGS.ollabridge, ...ob },
  });
}

const originalFetch = globalThis.fetch;
function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response> | Response) {
  (globalThis as Record<string, unknown>).fetch = (input: unknown, init?: RequestInit) =>
    Promise.resolve(impl(String(input), init));
}
function jsonResponse(body: unknown, ok = true): Response {
  return { ok, status: ok ? 200 : 500, json: async () => body } as unknown as Response;
}

beforeEach(() => installFakeWindow());
afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
  (globalThis as Record<string, unknown>).fetch = originalFetch;
});

// --- Settings store ----------------------------------------------------------------------------

describe("ai-settings-store", () => {
  it("defaults to provider none / deterministic", () => {
    assert.equal(getAISettings().provider, "none");
    assert.equal(getAISettings().mode, "deterministic");
  });

  it("persists to localStorage and reads back", () => {
    setSettings({ provider: "ollabridge", mode: "assisted" }, { model: "llama3:8b" });
    const read = getAISettings();
    assert.equal(read.provider, "ollabridge");
    assert.equal(read.mode, "assisted");
    assert.equal(read.ollabridge.model, "llama3:8b");
  });

  it("clearAISettings resets to defaults", () => {
    setSettings({ provider: "ollabridge" });
    clearAISettings();
    assert.equal(getAISettings().provider, "none");
  });

  it("falls back to defaults on malformed JSON", () => {
    window.localStorage.setItem("matrix-builder:ai-settings:v1", "{not json");
    assert.deepEqual(getAISettings(), DEFAULT_AI_SETTINGS);
  });

  it("merges partial/garbage objects against defaults", () => {
    assert.equal(mergeAISettings(null).provider, "none");
    assert.equal(mergeAISettings({ provider: "bogus" }).provider, "none");
    assert.equal(mergeAISettings({ ollabridge: { authMode: "weird" } }).ollabridge.authMode, "pairing");
    assert.equal(mergeAISettings({ ollabridge: {} }).ollabridge.baseUrl, DEFAULT_AI_SETTINGS.ollabridge.baseUrl);
  });
});

// --- OllaBridge client pure helpers ------------------------------------------------------------

describe("ollabridge-client helpers", () => {
  it("strips trailing slashes", () => {
    assert.equal(stripTrailingSlash("https://app.ollabridge.com///"), "https://app.ollabridge.com");
  });

  it("rejects a base URL ending in /v1", () => {
    assert.throws(() => assertRootBaseUrl("https://app.ollabridge.com/v1"));
    assert.throws(() => assertRootBaseUrl("https://app.ollabridge.com/v1/"));
    assert.doesNotThrow(() => assertRootBaseUrl("https://app.ollabridge.com"));
  });

  it("normalizes pairing codes (trim, upper, remove spaces and hyphens)", () => {
    assert.equal(normalizePairingCode("  ojqw-5764 "), "OJQW5764");
    assert.equal(normalizePairingCode("oj qw 57 64"), "OJQW5764");
  });

  it("detects localhost-like URLs", () => {
    assert.equal(isLocalhostLike("http://localhost:11434"), true);
    assert.equal(isLocalhostLike("http://127.0.0.1"), true);
    assert.equal(isLocalhostLike("https://app.ollabridge.com"), false);
  });

  it("derives the OpenAI-compatible endpoints from the root", () => {
    assert.equal(chatUrl("https://x.dev/"), "https://x.dev/v1/chat/completions");
    assert.equal(modelsUrl("https://x.dev"), "https://x.dev/v1/models");
    assert.equal(pairingUrl("https://x.dev"), "https://x.dev/pair");
  });

  it("builds the right Authorization header per auth mode", () => {
    const base = DEFAULT_AI_SETTINGS.ollabridge;
    assert.equal(authHeader({ ...base, authMode: "pairing", pairToken: "tok" }).Authorization, "Bearer tok");
    assert.equal(authHeader({ ...base, authMode: "api_key", apiKey: "key" }).Authorization, "Bearer key");
    assert.deepEqual(authHeader({ ...base, authMode: "local-trust" }), {}); // no header for local trust
  });
});

// --- OllaBridge network calls (stubbed fetch) --------------------------------------------------

describe("ollabridge-client network", () => {
  const ob: OllaBridgeSettings = { ...DEFAULT_AI_SETTINGS.ollabridge };

  it("fetch models hits /v1/models and selects the default", async () => {
    let calledUrl = "";
    stubFetch((url) => { calledUrl = url; return jsonResponse({ data: [{ id: "qwen2.5:1.5b" }, { id: "llama3:8b" }] }); });
    const result = await fetchOllaBridgeModels(ob);
    assert.match(calledUrl, /\/v1\/models$/);
    assert.deepEqual(result.models, ["qwen2.5:1.5b", "llama3:8b"]);
    assert.equal(result.selected, "qwen2.5:1.5b");
  });

  it("chat hits /v1/chat/completions and returns the message content", async () => {
    let calledUrl = "";
    stubFetch((url) => { calledUrl = url; return jsonResponse({ choices: [{ message: { content: "hi" } }] }); });
    const out = await sendOllaBridgeChat(ob, [{ role: "user", content: "x" }]);
    assert.match(calledUrl, /\/v1\/chat\/completions$/);
    assert.equal(out, "hi");
  });

  it("pairing posts the normalized code to /pair and stores the token", async () => {
    let body: Record<string, unknown> = {};
    let calledUrl = "";
    stubFetch((url, init) => { calledUrl = url; body = JSON.parse(String(init?.body)); return jsonResponse({ token: "T", device_id: "D" }); });
    const result = await pairWithOllaBridge(ob, "oj qw-5764");
    assert.match(calledUrl, /\/pair$/);
    assert.equal(body.code, "OJQW5764");
    assert.equal(body.label, "matrix-builder");
    assert.equal(result.pairToken, "T");
    assert.equal(result.deviceId, "D");
  });
});

// --- Enrichment guards (the contract-safety core) ----------------------------------------------

describe("sanitizeEnrichment", () => {
  const originals = [
    { id: "minimal", tier: "Minimal", name: "A", summary: "a" },
    { id: "standard", tier: "Standard", name: "B", summary: "b" },
  ];

  it("keeps only display* fields and drops contract fields like id/tier/stack/files", () => {
    const out = sanitizeEnrichment(originals, {
      candidates: [
        { id: "minimal", displayName: "Nice A", displaySummary: "nice a", displayRationale: "because",
          tier: "Production", stack: ["evil"], files: 999, tasks: ["x"], allowed_files: ["/etc"] },
      ],
    });
    assert.deepEqual(out.minimal, { displayName: "Nice A", displaySummary: "nice a", displayRationale: "because" });
    // None of the forbidden fields leak through.
    assert.equal((out.minimal as Record<string, unknown>).tier, undefined);
    assert.equal((out.minimal as Record<string, unknown>).stack, undefined);
    assert.equal((out.minimal as Record<string, unknown>).files, undefined);
  });

  it("ignores unknown / hallucinated candidate ids", () => {
    const out = sanitizeEnrichment(originals, { candidates: [{ id: "ghost", displayName: "X" }] });
    assert.deepEqual(out, {});
  });

  it("returns empty for non-array / malformed AI output", () => {
    assert.deepEqual(sanitizeEnrichment(originals, null), {});
    assert.deepEqual(sanitizeEnrichment(originals, { candidates: "nope" }), {});
  });
});

// --- Manager: assist gating + fail-open --------------------------------------------------------

describe("ai-provider-manager gating", () => {
  const candidates = [{ id: "minimal", tier: "Minimal", name: "A", summary: "a" }];

  it("assist is disabled by default (provider none)", () => {
    assert.equal(isAssistEnabled(), false);
  });

  it("provider none → enrich makes no AI call and returns empty", async () => {
    stubFetch(() => { throw new Error("fetch must not be called when provider is none"); });
    const out = await enrichBlueprintCandidates("idea", candidates);
    assert.deepEqual(out, {});
  });

  it("provider none → explain makes no AI call and returns null", async () => {
    stubFetch(() => { throw new Error("fetch must not be called when provider is none"); });
    const out = await explainValidationFindings({ status: "approved", score: 100, findings: [] });
    assert.equal(out, null);
  });

  it("OllaBridge assist failure falls back to deterministic (empty enrichment)", async () => {
    setSettings({ provider: "ollabridge", mode: "assisted" });
    assert.equal(isAssistEnabled(), true);
    stubFetch(() => jsonResponse({}, false)); // server error
    const out = await enrichBlueprintCandidates("idea", candidates);
    assert.deepEqual(out, {});
  });

  it("validation explanation returns helper text without mutating the findings input", async () => {
    setSettings({ provider: "ollabridge", mode: "assisted" });
    stubFetch(() => jsonResponse({ choices: [{ message: { content: "Looks good. Ship it." } }] }));
    const findings = [{ label: "RMD-103", message: "forbidden file" }];
    const out = await explainValidationFindings({ status: "rejected", score: 65, findings });
    assert.equal(out, "Looks good. Ship it.");
    assert.deepEqual(findings, [{ label: "RMD-103", message: "forbidden file" }]); // unchanged
  });
});

// --- Batch 7 — ProjectBrief enhancement (Seam 1) ----------------------------------------------

const BASE_BRIEF: ProjectBriefContract = {
  schema_version: "matrix.builder.brief/v1",
  source_type: "document",
  title: "Doc QA",
  summary: "original summary",
  domain: null,
  goals: ["original goal"],
  users: [],
  features: ["original feature"],
  screens: [],
  integrations: [],
  constraints: [],
  risks: [],
  non_functional: [],
  source_files: ["brief.pdf"],
  enhanced_by: "deterministic",
};

describe("Batch 7 — brief enhancement", () => {
  it("sanitizeBrief discards when title/summary missing", () => {
    assert.equal(sanitizeBrief(BASE_BRIEF, { confidence: 0.9 }).enhanced_by, "deterministic");
  });

  it("sanitizeBrief discards when confidence below 0.65", () => {
    const out = sanitizeBrief(BASE_BRIEF, { title: "X", summary: "Y", confidence: 0.4 });
    assert.equal(out.enhanced_by, "deterministic");
    assert.equal(out.title, "Doc QA");
  });

  it("sanitizeBrief applies only safe fields when valid + confident", () => {
    const out = sanitizeBrief(BASE_BRIEF, {
      title: "Better Title", summary: "Better summary", features: ["a", "b"],
      confidence: 0.82, source_type: "design", enhanced_by: "ollabridge", evil: "ignored",
    });
    assert.equal(out.enhanced_by, "ollabridge");
    assert.equal(out.title, "Better Title");
    assert.deepEqual(out.features, ["a", "b"]);
    assert.equal(out.source_type, "document"); // AI cannot change the source type
    assert.equal((out as Record<string, unknown>).evil, undefined);
  });

  it("isOllaBridgeAssistAvailable is false when signed out (even with OllaBridge enabled)", () => {
    setSettings({ provider: "ollabridge", mode: "assisted" });
    assert.equal(isOllaBridgeAssistAvailable(), false);
  });

  it("isOllaBridgeAssistAvailable is true when signed in + OllaBridge assisted", () => {
    setSettings({ provider: "ollabridge", mode: "assisted" });
    window.localStorage.setItem("mb_user", JSON.stringify({ email: "a@b.c" }));
    assert.equal(isOllaBridgeAssistAvailable(), true);
  });

  it("enhanceProjectBrief returns the deterministic brief (no AI call) when assist unavailable", async () => {
    stubFetch(() => { throw new Error("fetch must not be called when assist is unavailable"); });
    const out = await enhanceProjectBrief(BASE_BRIEF); // signed out by default
    assert.equal(out.enhanced_by, "deterministic");
  });

  it("briefToIdea folds title + summary + features", () => {
    const idea = briefToIdea({ title: "Doc QA", summary: "answers with citations", features: ["upload", "search"] });
    assert.match(idea, /Doc QA/);
    assert.match(idea, /upload/);
  });
});
