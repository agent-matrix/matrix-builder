// High-level Internal AI manager — the single seam the app uses for optional assist.
//
// Mirrors the role of LLMManager.js in ruslanmv/3D-Avatar-Chatbot, but constrained to Matrix
// Builder's contract: the deterministic engine owns idea parsing, candidates, bundle, allowed
// files, validation and commits. This manager may ONLY improve the words a user reads — never the
// contract they build from. Every assist path is fail-open: any error, timeout, missing config, or
// provider="none" returns the deterministic input unchanged and makes no claim on the result.

import { getAISettings, saveAISettings } from "@/lib/ai-settings-store";
import { getUser } from "@/lib/auth-token";
import {
  fetchOllaBridgeModels,
  pairWithOllaBridge as pairClient,
  sendOllaBridgeChat,
  type ChatMessage,
  type ModelResult,
  type PairResult,
} from "@/lib/ollabridge-client";
import type { MatrixAISettings } from "@/types/ai-settings";
import type { ProjectBriefContract } from "@/lib/workflow-types";

export { getAISettings, saveAISettings };

// Assist is live only when the user explicitly chose OllaBridge AND turned on assisted mode.
export function isAssistEnabled(settings: MatrixAISettings = getAISettings()): boolean {
  return settings.provider === "ollabridge" && settings.mode === "assisted";
}

// Batch 7 gate: AI assist requires a signed-in user *and* OllaBridge enabled. Free/anonymous
// users always get the deterministic path.
export function isOllaBridgeAssistAvailable(): boolean {
  return isAssistEnabled() && Boolean(getUser());
}

export function pairWithOllaBridge(code: string): Promise<PairResult> {
  return pairClient(getAISettings().ollabridge, code);
}

export function fetchModels(): Promise<ModelResult> {
  return fetchOllaBridgeModels(getAISettings().ollabridge);
}

export function sendAIMessage(messages: ChatMessage[]): Promise<string> {
  return sendOllaBridgeChat(getAISettings().ollabridge, messages);
}

// --- Candidate display enrichment (display-only) -------------------------------------------

// Only these three fields may ever be replaced by AI. Everything that drives bundle generation
// (id, tier, stack, files, tasks, standards, …) is off-limits and is never sent or accepted.
export type CandidateEnrichment = {
  displayName?: string;
  displaySummary?: string;
  displayRationale?: string;
};
export type EnrichmentMap = Record<string, CandidateEnrichment>;

type CandidateLite = { id: string; tier: string; name: string; summary: string };

const ENRICH_SYSTEM =
  "You are an internal Matrix Builder assistant. You may improve explanations and wording, " +
  "but you cannot change the Matrix contract. Return STRICT JSON only.";

function enrichPrompt(idea: string, candidates: CandidateLite[]): string {
  const slim = candidates.map((c) => ({ id: c.id, tier: c.tier, name: c.name, summary: c.summary }));
  return (
    `Idea: ${idea}\n\n` +
    `Candidates: ${JSON.stringify(slim)}\n\n` +
    `Rewrite ONLY the display copy to be clearer and more compelling. Do not invent stacks, files, ` +
    `or tiers. Respond with strict JSON of the form:\n` +
    `{"candidates":[{"id":"<same id>","displayName":"...","displaySummary":"...","displayRationale":"..."}]}`
  );
}

// Keep only string fields, only for ids that exist in the originals. Never mutates inputs. Exported
// so the contract guard ("AI cannot change id/tier/stack/...") is directly unit-tested.
export function sanitizeEnrichment(originals: CandidateLite[], aiResult: unknown): EnrichmentMap {
  const allowed = new Set(originals.map((c) => c.id));
  const out: EnrichmentMap = {};
  const list = (aiResult as { candidates?: unknown })?.candidates;
  if (!Array.isArray(list)) return out;
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    if (!allowed.has(id)) continue; // ignore unknown / hallucinated ids
    const entry: CandidateEnrichment = {};
    if (typeof row.displayName === "string" && row.displayName.trim()) entry.displayName = row.displayName.trim();
    if (typeof row.displaySummary === "string" && row.displaySummary.trim()) entry.displaySummary = row.displaySummary.trim();
    if (typeof row.displayRationale === "string" && row.displayRationale.trim()) entry.displayRationale = row.displayRationale.trim();
    if (Object.keys(entry).length > 0) out[id] = entry;
  }
  return out;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Models sometimes wrap JSON in prose/code fences; salvage the first {...} block.
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

// Returns display-only overrides keyed by candidate id. Fail-open: {} on any problem, so callers
// always fall back to the deterministic candidate copy and the bundle still compiles unchanged.
export async function enrichBlueprintCandidates(
  idea: string,
  candidates: CandidateLite[],
): Promise<EnrichmentMap> {
  if (!isAssistEnabled() || candidates.length === 0) return {};
  try {
    const text = await sendAIMessage([
      { role: "system", content: ENRICH_SYSTEM },
      { role: "user", content: enrichPrompt(idea, candidates) },
    ]);
    const parsed = tryParseJson(text);
    if (!parsed) return {};
    return sanitizeEnrichment(candidates, parsed);
  } catch {
    return {};
  }
}

// --- Validation explanation (text-only; never alters status/score/findings) ----------------

export type ValidationSummaryInput = {
  status: string;
  score: number;
  findings: Array<{ label?: string; message?: string }>;
};

const EXPLAIN_SYSTEM =
  "You are an internal Matrix Builder assistant. Explain the deterministic validation result in " +
  "plain language and suggest one next step. You cannot change the status, score, or findings.";

// Returns a friendly explanation string, or null on any problem (caller shows the deterministic
// result alone). The status/score/findings passed in are authoritative and are never echoed back
// as authority — this is helper copy only.
export async function explainValidationFindings(
  input: ValidationSummaryInput,
): Promise<string | null> {
  if (!isAssistEnabled()) return null;
  try {
    const findings = input.findings
      .map((f) => `- ${f.label ?? "finding"}: ${f.message ?? ""}`)
      .join("\n");
    const text = await sendAIMessage([
      { role: "system", content: EXPLAIN_SYSTEM },
      {
        role: "user",
        content:
          `Validation status: ${input.status} (score ${input.score}/100).\n` +
          `Findings:\n${findings || "- none"}\n\n` +
          `In 2-3 short sentences, explain what this means and the single best next step.`,
      },
    ]);
    const trimmed = text.trim();
    return trimmed ? trimmed : null;
  } catch {
    return null;
  }
}

// --- ProjectBrief enhancement (Seam 1, text-only, fail-open) -----------------------------------

const ENHANCE_SYSTEM =
  "You are helping Matrix Builder understand project input. Return a ProjectBrief as STRICT JSON " +
  "only. Do not create a blueprint, Matrix files, variants, validation, or approval.";
const CONFIDENCE_THRESHOLD = 0.65;

function _strList(v: unknown, limit: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim().slice(0, 160))
    .slice(0, limit);
}

// Pure + exported for unit tests: merge an AI result onto the deterministic brief, keeping ONLY
// safe descriptive fields. Returns the ORIGINAL brief when the AI output is invalid, missing
// title/summary, or below the confidence threshold — so the deterministic brief always stands.
export function sanitizeBrief(original: ProjectBriefContract, aiResult: unknown): ProjectBriefContract {
  const r = (aiResult && typeof aiResult === "object" ? aiResult : {}) as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title.trim() : "";
  const summary = typeof r.summary === "string" ? r.summary.trim() : "";
  const confidence = typeof r.confidence === "number" ? r.confidence : Number.NaN;
  if (!title || !summary || !(confidence >= CONFIDENCE_THRESHOLD)) return original;

  const goals = _strList(r.goals, 8);
  const features = _strList(r.features, 12);
  const users = _strList(r.users, 8);
  const nfr = _strList((r.nonFunctionalRequirements ?? r.non_functional) as unknown, 8);
  return {
    ...original,
    title: title.slice(0, 120),
    summary: summary.slice(0, 400),
    goals: goals.length ? goals : original.goals,
    features: features.length ? features : original.features,
    users: users.length ? users : original.users,
    non_functional: nfr.length ? nfr : original.non_functional,
    missingQuestions: _strList(r.missingQuestions, 6),
    confidence,
    enhanced_by: "ollabridge",
  };
}

// Optionally enrich a deterministic ProjectBrief via OllaBridge (signed-in + assist only).
// Fail-open: any problem returns the original brief unchanged.
export async function enhanceProjectBrief(brief: ProjectBriefContract): Promise<ProjectBriefContract> {
  if (!isOllaBridgeAssistAvailable()) return brief;
  try {
    const user =
      "Improve this ProjectBrief, staying truthful to the source. Return STRICT JSON with fields: " +
      "title, summary, goals[], features[], users[], nonFunctionalRequirements[], missingQuestions[], " +
      "confidence (0..1).\n\n" +
      JSON.stringify({ title: brief.title, summary: brief.summary, features: brief.features, goals: brief.goals });
    const text = await sendAIMessage([
      { role: "system", content: ENHANCE_SYSTEM },
      { role: "user", content: user },
    ]);
    const parsed = tryParseJson(text);
    return parsed ? sanitizeBrief(brief, parsed) : brief;
  } catch {
    return brief;
  }
}

// Fold a brief into the idea string the deterministic engine parses (mirrors the backend).
export function briefToIdea(b: { title: string; summary: string; features?: string[]; goals?: string[] }): string {
  const parts = [b.title?.trim(), b.summary?.trim()].filter(Boolean) as string[];
  if (b.features?.length) parts.push("Key features: " + b.features.slice(0, 6).join(", "));
  if (b.goals?.length) parts.push("Goals: " + b.goals.slice(0, 4).join(", "));
  const idea = parts.join(". ");
  return idea.length >= 5 ? idea.slice(0, 3900) : (b.title || "Imported project");
}
