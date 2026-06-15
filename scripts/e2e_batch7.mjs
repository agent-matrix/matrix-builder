// Batch 7 E2E — "a simple hello world website", WITHOUT and WITH OllaBridge.
//
// Verifies the deployed product end to end using the SAME browser code the app ships
// (@/lib/ai-provider-manager) against the live engine API and live OllaBridge:
//   • WITHOUT OllaBridge → deterministic spine: idea → 3 candidates → bundle → validate.
//   • WITH OllaBridge (signed-in + assisted) → Seam 1 (enhanceProjectBrief) + Seam 2
//     (enrichBlueprintCandidates), both fail-open; then the same deterministic spine.
//
// Run (from repo root):
//   OLLABRIDGE_TOKEN=<token> MB_API=https://ruslanmv-matrix-builder.hf.space/api/builder \
//     node --experimental-strip-types --import ./apps/web/test/setup.mjs scripts/e2e_batch7.mjs
//
// Token from env only; never stored/printed. No credential → the WITH section skips cleanly.

import {
  briefToIdea,
  enhanceProjectBrief,
  enrichBlueprintCandidates,
  isOllaBridgeAssistAvailable,
  saveAISettings,
} from "@/lib/ai-provider-manager";

const MB = process.env.MB_API ?? "http://127.0.0.1:8011";
const BASE = process.env.OLLABRIDGE_BASE_URL ?? "https://app.ollabridge.com";
const MODEL = process.env.OLLABRIDGE_MODEL ?? "qwen2.5:1.5b";
const IDEA = "a simple hello world website";
let PASS = 0, FAIL = 0;
const step = (n, m) => console.log(`\n[36m[${n}][0m ${m}`);
const ok = (m) => { PASS++; console.log(`   [32m✓[0m ${m}`); };
const bad = (m) => { FAIL++; console.log(`   [31m✗ ${m}[0m`); };
const check = (c, m) => (c ? ok(m) : bad(m));

function installWindow() {
  const s = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (s.has(k) ? s.get(k) : null),
      setItem: (k, v) => void s.set(k, String(v)),
      removeItem: (k) => void s.delete(k),
    },
    dispatchEvent: () => true, addEventListener: () => {}, removeEventListener: () => {},
  };
  return s;
}

async function mb(path, body) {
  const res = await fetch(`${MB}${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${t.slice(0, 160)}`);
  return t ? JSON.parse(t) : {};
}

// One run of the deterministic spine on the engine API (no AI).
async function spine(idea) {
  const cand = await mb("/api/v1/blueprints/candidates", { idea });
  const candidates = cand.candidates ?? [];
  check(candidates.length === 3, `3 candidates (${candidates.map((c) => c.quality_level).join("/")})`);
  const chosen = candidates.find((c) => c.recommended) ?? candidates[1] ?? candidates[0];
  const bundle = await mb("/api/v1/bundles", {
    idea_request: { idea }, preferred_coder: "claude-code", candidate_id: chosen.candidate_id,
  });
  check(Boolean(bundle.bundle_id), `bundle ${bundle.bundle_id} (${(bundle.files ?? []).length} files)`);
  const approved = await mb("/api/v1/validation/patch", {
    bundle_id: bundle.bundle_id, mode: "patch", changed_files: [{ path: "frontend/app/page.tsx", status: "modified" }],
  });
  check(approved.status === "approved", `in-scope → ${approved.status} (${approved.score})`);
  const rejected = await mb("/api/v1/validation/patch", {
    bundle_id: bundle.bundle_id, mode: "patch", changed_files: [{ path: "MATRIX_BLUEPRINT.yaml", status: "modified" }],
  });
  check(rejected.status === "rejected", `forbidden → ${rejected.status} (${rejected.score})`);
  return candidates;
}

function detBrief() {
  return {
    schema_version: "matrix.builder.brief/v1", source_type: "document",
    title: "Simple Hello World Website", summary: "A one-page website that shows Hello, World.",
    domain: null, goals: ["Show a hello world page"], users: [], features: ["single page", "hello world text"],
    screens: [], integrations: [], constraints: [], risks: [], non_functional: [], source_files: [],
    enhanced_by: "deterministic",
  };
}

async function main() {
  const store = installWindow();
  console.log(`Engine API: ${MB}\nOllaBridge: ${BASE} (${MODEL})\nIdea: "${IDEA}"`);

  // ── WITHOUT OllaBridge (provider none → assist off) ──
  step("A", "WITHOUT OllaBridge — deterministic spine on the deployed engine");
  saveAISettings({ provider: "none", mode: "deterministic", ollabridge: { authMode: "pairing", baseUrl: BASE, model: MODEL, apiKey: "", pairToken: "", deviceId: "" } });
  check(isOllaBridgeAssistAvailable() === false, "assist OFF (no OllaBridge / not signed in)");
  const det = await enhanceProjectBrief(detBrief());
  check(det.enhanced_by === "deterministic", "enhanceProjectBrief returns deterministic brief (no AI call)");
  await spine(IDEA);

  // ── WITH OllaBridge (signed-in + assisted) ──
  const token = process.env.OLLABRIDGE_TOKEN ?? "";
  if (!token) { console.log("\n[33mWITH-OllaBridge section SKIPPED (no OLLABRIDGE_TOKEN).[0m"); return finish(); }
  step("B", "WITH OllaBridge — signed-in + assisted (Seam 1 + Seam 2)");
  store.set("mb_user", JSON.stringify({ email: "tester@matrixhub.io" }));
  saveAISettings({ provider: "ollabridge", mode: "assisted", ollabridge: { authMode: "pairing", baseUrl: BASE, model: MODEL, apiKey: "", pairToken: token, deviceId: "" } });
  check(isOllaBridgeAssistAvailable() === true, "assist ON (signed-in + OllaBridge configured)");

  // Seam 1 — enhance the brief (fail-open: deterministic or ollabridge are both acceptable).
  const enhanced = await enhanceProjectBrief(detBrief());
  check(["deterministic", "ollabridge"].includes(enhanced.enhanced_by),
    `Seam 1 brief: enhanced_by=${enhanced.enhanced_by}${enhanced.confidence ? ` (conf ${enhanced.confidence})` : ""}`);
  check(Boolean(enhanced.title && enhanced.summary), "brief still has title + summary");

  const idea = briefToIdea(enhanced);
  step("C", "Deterministic spine on the (possibly enhanced) idea");
  const candidates = await spine(idea);

  // Seam 2 — candidate copy polish (display fields only; fail-open empty is fine).
  step("D", "Seam 2 — candidate display-copy polish (display-only)");
  const lite = candidates.map((c) => ({
    id: c.quality_level === "starter" ? "minimal" : c.quality_level === "production" ? "production" : "standard",
    tier: c.title, name: c.title, summary: c.summary,
  }));
  const seen = new Set();
  const liteU = lite.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  const enrich = await enrichBlueprintCandidates(idea, liteU);
  const ids = Object.keys(enrich);
  if (ids.length) {
    const leaked = ids.some((id) => Object.keys(enrich[id]).some((k) => !["displayName", "displaySummary", "displayRationale"].includes(k)));
    check(!leaked, `polished ${ids.length} candidate(s); display-only (no contract fields)`);
  } else ok("polish empty → deterministic copy kept (fail-open)");

  // Gate — sign out → assist must turn OFF.
  step("E", "Gate — sign out → assist OFF, enhancement returns deterministic");
  store.delete("mb_user");
  check(isOllaBridgeAssistAvailable() === false, "assist OFF when signed out");
  const det2 = await enhanceProjectBrief(detBrief());
  check(det2.enhanced_by === "deterministic", "no AI when signed out");

  finish();
}

function finish() {
  console.log(`\n${"─".repeat(56)}\nResult: [1m${PASS} passed, ${FAIL} failed[0m`);
  if (FAIL > 0) process.exit(1);
}

main().catch((e) => { console.error(`\n[31mE2E ERROR:[0m ${e?.message ?? e}`); process.exit(1); });
