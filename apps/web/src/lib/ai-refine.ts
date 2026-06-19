// C3 — Optional AI enhancement for the Blueprint workspace.
//
// After the in-browser engine has ALREADY applied a chat instruction (instant, governed), this
// makes ONE provider-agnostic call (through OllaBridge, which can bridge to any model) to refine
// only the EXPLANATION — `overview` / `designBrain` prose and a short `reply`. It is:
//   • optional   — returns null when assist is off / no user (deterministic result stands)
//   • bounded    — a hard timeout; a slow model never blocks the UI
//   • fail-open  — any error/parse-failure returns null
//   • safe       — it can never change architecture, batches, or files (governance unchanged)

import { isOllaBridgeAssistAvailable, sendAIMessage } from "@/lib/ai-provider-manager";
import type { BlueprintDetailsData } from "@/types/blueprint-state";

export interface AIRefinement {
  reply?: string;
  overview?: string;
  designBrain?: string;
}

const SYSTEM =
  "You refine the EXPLANATION of a software blueprint after a change was applied. You may improve " +
  "the 'overview' and 'designBrain' prose and write a short 'reply' confirming the change. You MUST " +
  "NOT invent or change architecture, batches, files, or stack. Return ONLY compact JSON of the form " +
  '{"reply":"...","overview":"...","designBrain":"..."} with no extra text.';

export async function refineWithAI(
  data: BlueprintDetailsData,
  instruction: string,
  opts: { timeoutMs?: number } = {},
): Promise<AIRefinement | null> {
  if (!isOllaBridgeAssistAvailable()) return null;
  const timeoutMs = opts.timeoutMs ?? 6000;
  const user =
    `Instruction just applied: ${instruction}\n` +
    `Current overview: ${data.overview}\n` +
    `Batches: ${data.batches.map((b) => b.name).join(", ")}\n` +
    `Architecture: ${data.architecture.map((n) => n.name).join(", ")}`;
  try {
    const text = await withTimeout(
      sendAIMessage([
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ]),
      timeoutMs,
    );
    const json = extractJson(text);
    if (!json) return null;
    const out: AIRefinement = {};
    if (typeof json.reply === "string" && json.reply.trim()) out.reply = json.reply.trim();
    if (typeof json.overview === "string" && json.overview.trim()) out.overview = json.overview.trim();
    if (typeof json.designBrain === "string" && json.designBrain.trim()) out.designBrain = json.designBrain.trim();
    return Object.keys(out).length ? out : null;
  } catch {
    return null; // fail-open: the deterministic local result stands
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("ai-refine timeout")), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

function extractJson(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}
