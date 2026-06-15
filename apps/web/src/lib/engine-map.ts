// Map agent-generator engine contracts → the UI's view types.
//
// The engine (via /blueprints/candidates and /bundles) speaks its signed contract shape; the
// build screens render the lighter `BlueprintCandidate` / `BundleFile` view types. This is the one
// place that translates between them, so a candidate/bundle the UI shows is the engine's — only
// re-labelled, never re-invented. The deterministic offline generators (matrix-demo-data.ts /
// matrix-bundle.ts) are now fallbacks used only when the API is unreachable.

import type { BlueprintCandidateContract, MatrixBundleContract } from "@/types/contracts";
import type { BlueprintCandidate } from "@/types/blueprint";
import type { BundleFile } from "@/types/bundle";

// Engine quality levels collapse onto the three tiers the cards understand.
const QUALITY_TO_ID: Record<string, BlueprintCandidate["id"]> = {
  starter: "minimal",
  minimal: "minimal",
  standard: "standard",
  production: "production",
  enterprise: "production",
};
const ID_TO_TIER: Record<BlueprintCandidate["id"], BlueprintCandidate["tier"]> = {
  minimal: "Minimal",
  standard: "Standard",
  production: "Production",
};
const DIFFICULTY: Record<string, BlueprintCandidate["difficulty"]> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

export function toUiCandidate(c: BlueprintCandidateContract): BlueprintCandidate {
  const id = QUALITY_TO_ID[c.quality_level] ?? "standard";
  return {
    id,
    tier: ID_TO_TIER[id],
    name: c.title,
    summary: c.summary,
    stack: c.stack,
    files: c.estimated_files,
    difficulty: DIFFICULTY[c.difficulty] ?? "Medium",
    time: c.estimated_effort,
    standards: c.validation_checks ?? [],
    recommended: c.recommended,
    // Carried through so choose() can ask the engine for *this* candidate's bundle.
    candidate_id: c.candidate_id,
    slug: c.slug,
    quality_level: c.quality_level,
    generator_actions: c.generator_actions,
    validation_checks: c.validation_checks,
  };
}

export function toUiCandidates(cs: BlueprintCandidateContract[]): BlueprintCandidate[] {
  return cs.map(toUiCandidate);
}

// The engine returns the bundle's file manifest (paths + kind); the tree/count the UI shows are
// these, verbatim. File contents come from the engine's /download zip, not reconstructed here.
export function toUiBundleFiles(bundle: MatrixBundleContract): BundleFile[] {
  return bundle.files.map((f) => ({
    name: f.path,
    content: "",
    path: f.path,
    kind: f.kind,
    required: f.required,
  }));
}
