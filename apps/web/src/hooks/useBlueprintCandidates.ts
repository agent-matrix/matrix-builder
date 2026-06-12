import { getBlueprintCandidates } from "../lib/api-client";

export function useBlueprintCandidates() {
  return { status: "ready", getBlueprintCandidates } as const;
}
