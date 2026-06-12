import { getBundlePrompt } from "../lib/api-client";

export function usePromptCopy() {
  return { status: "ready", getBundlePrompt } as const;
}
