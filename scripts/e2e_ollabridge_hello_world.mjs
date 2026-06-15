// End-to-end workflow test: a "hello world" website built through the full Matrix Builder loop,
// with OllaBridge doing BOTH AI roles so we can verify the whole pipeline live.
//
//   Deterministic engine  → idea → 3 candidates → Matrix Bundle → coder prompt → validation (judge)
//   Internal AI (OllaBridge) → enrich candidate copy (display-only) + explain validation findings
//   External AI coder (OllaBridge) → write the hello-world implementation from the bundle prompt
//
// It exercises the REAL browser code paths: @/lib/ollabridge-client and @/lib/ai-provider-manager
// (the same functions the UI calls), against the REAL OllaBridge server and the local engine API.
//
// Run (from repo root):
//   AGENT_GENERATOR_MODE=sdk  python -m uvicorn ... --port 8011   # engine API up first
//   OLLABRIDGE_TOKEN=<paired token>  node --experimental-strip-types \
//     --import ./apps/web/test/setup.mjs  scripts/e2e_ollabridge_hello_world.mjs
//
// Or pair inline:  OLLABRIDGE_PAIR_CODE=ABCD-1234  node ... (no token needed)
//
// Env: OLLABRIDGE_TOKEN | OLLABRIDGE_PAIR_CODE, OLLABRIDGE_BASE_URL (default app.ollabridge.com),
//      OLLABRIDGE_MODEL (default qwen2.5:1.5b), MB_API (default http://127.0.0.1:8011).
// No secrets are stored or printed; the token lives only in process env.

import assert from "node:assert/strict";

import {
  fetchOllaBridgeModels,
  pairWithOllaBridge,
  sendOllaBridgeChat,
} from "@/lib/ollabridge-client";
import {
  enrichBlueprintCandidates,
  explainValidationFindings,
  isAssistEnabled,
  saveAISettings,
} from "@/lib/ai-provider-manager";

const BASE = process.env.OLLABRIDGE_BASE_URL ?? "https://app.ollabridge.com";
const MODEL = process.env.OLLABRIDGE_MODEL ?? "qwen2.5:1.5b";
const MB = process.env.MB_API ?? "http://127.0.0.1:8011";
const IDEA = "a simple hello world website with a single page that says Hello, World";

let PASS = 0;
let FAIL = 0;
const step = (n, msg) => console.log(`\n[36m[${n}][0m ${msg}`);
const ok = (msg) => { PASS++; console.log(`   [32m✓[0m ${msg}`); };
const bad = (msg) => { FAIL++; console.log(`   [31m✗ ${msg}[0m`); };
function check(cond, msg) { (cond ? ok : bad)(msg); return cond; }

// Minimal window/localStorage shim so the manager (browser code) reads our settings under node.
function installWindow() {
  const m = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => void m.set(k, String(v)),
      removeItem: (k) => void m.delete(k),
    },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

async function mb(path, init) {
  const res = await fetch(`${MB}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : undefined;
}

async function main() {
  installWindow();

  // CI-friendly skip: when no credential is configured (e.g. a fork PR without the secret), exit 0
  // with a clear notice instead of failing the build. Set OLLABRIDGE_TOKEN or OLLABRIDGE_PAIR_CODE
  // (a repo secret) to actually run the live test.
  if (!process.env.OLLABRIDGE_TOKEN && !process.env.OLLABRIDGE_PAIR_CODE) {
    console.log("SKIPPED: no OLLABRIDGE_TOKEN or OLLABRIDGE_PAIR_CODE set — live OllaBridge E2E not run.");
    process.exit(0);
  }

  console.log(`OllaBridge: ${BASE}  model=${MODEL}\nEngine API: ${MB}\nIdea: "${IDEA}"`);

  // --- Obtain an OllaBridge token (device pairing) -----------------------------------------
  step("0", "Connect to OllaBridge (device pairing)");
  let pairToken = process.env.OLLABRIDGE_TOKEN ?? "";
  let deviceId = "";
  if (!pairToken && process.env.OLLABRIDGE_PAIR_CODE) {
    const r = await pairWithOllaBridge(
      { authMode: "pairing", baseUrl: BASE, model: MODEL, apiKey: "", pairToken: "", deviceId: "" },
      process.env.OLLABRIDGE_PAIR_CODE,
    );
    pairToken = r.pairToken;
    deviceId = r.deviceId;
    ok(`paired (device ${deviceId || "?"}) — token received (not shown)`);
  } else {
    check(Boolean(pairToken), "OLLABRIDGE_TOKEN provided");
  }
  assert(pairToken, "Need OLLABRIDGE_TOKEN or OLLABRIDGE_PAIR_CODE");

  // Configure the optional Internal AI exactly as the Settings panel would (Device Pairing).
  const ob = { authMode: "pairing", baseUrl: BASE, model: MODEL, apiKey: "", pairToken, deviceId };
  saveAISettings({ provider: "ollabridge", mode: "assisted", ollabridge: ob });
  check(isAssistEnabled(), "assist enabled (provider=ollabridge, mode=assisted)");

  // --- OllaBridge connectivity: models -----------------------------------------------------
  step("1", "OllaBridge /v1/models");
  const models = await fetchOllaBridgeModels(ob);
  check(models.models.length > 0, `listed ${models.models.length} models (selected ${models.selected})`);

  // --- DETERMINISTIC: parse idea + 3 candidates --------------------------------------------
  step("2", "Engine: parse idea + 3 blueprint candidates (deterministic)");
  const intent = await mb(`/api/v1/ideas/parse`, { method: "POST", body: JSON.stringify({ idea: IDEA }) });
  check(Boolean(intent?.normalized_idea ?? intent?.goal ?? intent), "idea parsed");
  const cand = await mb(`/api/v1/blueprints/candidates`, { method: "POST", body: JSON.stringify({ idea: IDEA }) });
  const candidates = cand.candidates ?? [];
  check(candidates.length === 3, `got ${candidates.length} candidates`);
  const chosen = candidates.find((c) => c.recommended) ?? candidates[1] ?? candidates[0];
  console.log(`   → chosen: ${chosen.title} (${chosen.candidate_id})`);

  // --- INTERNAL AI: enrich candidate display copy (display-only, fail-open) -----------------
  step("3", "Internal AI (OllaBridge): enrich candidate copy — display-only");
  const lite = candidates.map((c) => ({
    id: c.quality_level === "starter" ? "minimal" : c.quality_level === "production" ? "production" : "standard",
    tier: c.title,
    name: c.title,
    summary: c.summary,
  }));
  // de-dupe ids so the map is meaningful
  const seen = new Set();
  const liteUnique = lite.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
  const enrichment = await enrichBlueprintCandidates(IDEA, liteUnique);
  const enriched = Object.keys(enrichment);
  if (enriched.length > 0) {
    ok(`enriched ${enriched.length} candidate(s) — sample: "${(enrichment[enriched[0]].displaySummary ?? enrichment[enriched[0]].displayName ?? "").slice(0, 80)}"`);
    // Contract guard: enrichment may ONLY carry display* fields.
    const leaked = enriched.some((id) =>
      Object.keys(enrichment[id]).some((k) => !["displayName", "displaySummary", "displayRationale"].includes(k)),
    );
    check(!leaked, "enrichment carries ONLY display fields (no id/tier/stack/files leakage)");
  } else {
    ok("enrichment empty → deterministic copy kept (fail-open path verified)");
  }

  // --- DETERMINISTIC: generate the Matrix Bundle + coder prompt -----------------------------
  step("4", "Engine: compile Matrix Bundle + coder prompt (deterministic)");
  const bundle = await mb(`/api/v1/bundles`, {
    method: "POST",
    body: JSON.stringify({ idea_request: { idea: IDEA }, preferred_coder: "claude-code", candidate_id: chosen.candidate_id }),
  });
  check(Boolean(bundle?.bundle_id), `bundle ${bundle.bundle_id} (${(bundle.files ?? []).length} files)`);
  const promptResp = await mb(`/api/v1/bundles/${bundle.bundle_id}/prompt/claude-code`);
  const promptText = promptResp?.prompt ?? promptResp?.prompt_text ?? "";
  check(promptText.length > 50, `coder prompt fetched (${promptText.length} chars)`);

  // --- EXTERNAL AI CODER: write the hello-world implementation from the prompt ---------------
  step("5", "External AI coder (OllaBridge): implement the batch from the prompt");
  const coderOut = await sendOllaBridgeChat(ob, [
    { role: "system", content: "You are an expert software engineer. Implement ONLY what the Matrix prompt asks. Output the code." },
    { role: "user", content: `${promptText}\n\nFor this verification, write a minimal single-file hello-world page for frontend/app/page.tsx that renders "Hello, World". Return just the file content.` },
  ]);
  check(coderOut.trim().length > 0, `coder returned an implementation (${coderOut.length} chars)`);
  console.log(`   ── coder output (first 220 chars) ──\n   ${coderOut.slice(0, 220).replace(/\n/g, "\n   ")}`);

  // --- DETERMINISTIC: validate the submitted change (the JUDGE) ------------------------------
  step("6", "Engine: validate in-scope change → expect APPROVED");
  const approved = await mb(`/api/v1/validation/patch`, {
    method: "POST",
    body: JSON.stringify({ bundle_id: bundle.bundle_id, mode: "patch", changed_files: [{ path: "frontend/app/page.tsx", status: "modified" }] }),
  });
  check(approved.status === "approved", `status=${approved.status} score=${approved.score}`);

  step("7", "Engine: validate forbidden control-file edit → expect REJECTED");
  const rejected = await mb(`/api/v1/validation/patch`, {
    method: "POST",
    body: JSON.stringify({ bundle_id: bundle.bundle_id, mode: "patch", changed_files: [{ path: "MATRIX_BLUEPRINT.yaml", status: "modified" }] }),
  });
  const ruleHit = [...(rejected.violations ?? []), ...(rejected.checks ?? [])].some(
    (f) => JSON.stringify(f).includes("forbidden") || JSON.stringify(f).toLowerCase().includes("control"),
  );
  check(rejected.status === "rejected", `status=${rejected.status} score=${rejected.score}`);
  check(ruleHit, "a forbidden/control-file finding was raised");

  // --- INTERNAL AI: explain the (authoritative) validation result ---------------------------
  step("8", "Internal AI (OllaBridge): explain the validation findings — text only");
  const explanation = await explainValidationFindings({
    status: rejected.status,
    score: rejected.score ?? 0,
    findings: [
      ...(rejected.violations ?? []).map((v) => ({ label: v.rule_id, message: v.message })),
      ...(rejected.checks ?? []).filter((c) => c.status === "failed").map((c) => ({ label: c.check_id, message: c.message })),
    ],
  });
  if (explanation) {
    ok(`explanation produced (${explanation.length} chars)`);
    console.log(`   ── AI explanation ──\n   ${explanation.slice(0, 300).replace(/\n/g, "\n   ")}`);
  } else {
    ok("no explanation (fail-open) — deterministic findings stand on their own");
  }

  // --- Summary ------------------------------------------------------------------------------
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Result: [1m${PASS} passed, ${FAIL} failed[0m`);
  console.log(`Deterministic spine + Internal AI + External AI coder all exercised against live OllaBridge.`);
  if (FAIL > 0) process.exit(1);
}

main().catch((e) => {
  console.error(`\n[31mE2E ERROR:[0m ${e?.message ?? e}`);
  process.exit(1);
});
