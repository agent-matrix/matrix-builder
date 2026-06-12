import { generateBundle, getBlueprintCandidates } from "../lib/api-client";

export function useMatrixBuilder() {
  return { status: "ready", getBlueprintCandidates, generateBundle } as const;
}
