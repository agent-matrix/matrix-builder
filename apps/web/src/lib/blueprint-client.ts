// Optional server bridge for the Blueprint Details workspace.
//
// The workspace is driven entirely by the in-browser engine + store (C0/C1/C2) — these fetch
// wrappers are the OPTIONAL enhancement path: when a control plane is configured they sync /
// fetch real designer output, and on any failure they fall back to the local engine. Nothing on
// the render path depends on them.

import { apiBaseUrl } from "./api-client";
import { authHeaders } from "./auth-token";
import * as engine from "@/lib/blueprint-engine";

export type {
  ArchitectureNode,
  BlueprintDetailsData,
  DesignerBatch,
  DesignerCandidate,
  DesignerChatMessage,
  FilePlanItem,
} from "@/types/blueprint-state";

import type { BlueprintDetailsData, DesignerCandidate } from "@/types/blueprint-state";

// Local engine derivations re-exported for back-compat with existing callers.
export const deriveLocalDetails = engine.generate;
export const deriveLocalCandidates = engine.generateCandidates;

/** The 3 blueprint cards. `useDesigner=false` (toggle off) / offline → local engine. */
export async function fetchDesignerCandidates(
  idea: string,
  opts: { useDesigner?: boolean } = {},
): Promise<DesignerCandidate[]> {
  if (opts.useDesigner === false) return engine.generateCandidates(idea);
  try {
    const url = `${apiBaseUrl}/api/v1/blueprints/designer-candidates?idea=${encodeURIComponent(idea)}`;
    const res = await fetch(url, { headers: { ...authHeaders() } });
    if (!res.ok) throw new Error(`designer-candidates ${res.status}`);
    const body = (await res.json()) as { candidates?: DesignerCandidate[] };
    return body.candidates && body.candidates.length ? body.candidates : engine.generateCandidates(idea);
  } catch {
    return engine.generateCandidates(idea);
  }
}

/** Optional: fetch real designer Details. Offline / toggle off → local engine. */
export async function fetchBlueprintDetails(
  candidateId: string,
  idea: string,
  opts: { useDesigner?: boolean } = {},
): Promise<BlueprintDetailsData> {
  if (opts.useDesigner === false) return engine.generate(candidateId, idea);
  try {
    const url = `${apiBaseUrl}/api/v1/blueprints/${candidateId}/details?idea=${encodeURIComponent(idea)}`;
    const res = await fetch(url, { headers: { ...authHeaders() } });
    if (!res.ok) throw new Error(`details ${res.status}`);
    return (await res.json()) as BlueprintDetailsData;
  } catch {
    return engine.generate(candidateId, idea);
  }
}

/** Optional server refinement; the workspace already applied the local engine result. */
export async function sendBlueprintChat(
  candidateId: string,
  idea: string,
  message: string,
): Promise<{ reply: string; details: BlueprintDetailsData }> {
  try {
    const url = `${apiBaseUrl}/api/v1/blueprints/${candidateId}/chat`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ idea, message }),
    });
    if (!res.ok) throw new Error(`chat ${res.status}`);
    return (await res.json()) as { reply: string; details: BlueprintDetailsData };
  } catch {
    const res = engine.apply(engine.generate(candidateId, idea), message);
    return { reply: res.reply, details: res.data };
  }
}

export async function saveBlueprintDetails(
  candidateId: string,
  idea: string,
  details: BlueprintDetailsData,
  buildId?: string,
): Promise<BlueprintDetailsData> {
  try {
    const url = `${apiBaseUrl}/api/v1/blueprints/${candidateId}/save`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ idea, build_id: buildId, details }),
    });
    if (!res.ok) throw new Error(`save ${res.status}`);
    return (await res.json()) as BlueprintDetailsData;
  } catch {
    return details; // offline: kept locally (localStorage persistence is C4)
  }
}

/** Restore a previously-saved blueprint + chat for a build (owner-scoped). */
export async function fetchSavedBlueprint(
  candidateId: string,
  buildId: string,
): Promise<BlueprintDetailsData | null> {
  try {
    const url = `${apiBaseUrl}/api/v1/blueprints/${candidateId}/saved?build_id=${encodeURIComponent(buildId)}`;
    const res = await fetch(url, { headers: { ...authHeaders() } });
    if (!res.ok) throw new Error(`saved ${res.status}`);
    const body = (await res.json()) as { found: boolean; details: BlueprintDetailsData | null };
    return body.found ? body.details : null;
  } catch {
    return null;
  }
}
