import { generateBundle } from "../lib/api-client";

export function useGenerateBundle() {
  return { status: "ready", generateBundle } as const;
}
