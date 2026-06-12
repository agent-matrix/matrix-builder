import type { CoderId } from "./coder";

export interface PromptRequest {
  coder: CoderId;
  bundleId: string;
}

export interface PromptResult {
  coder: CoderId;
  prompt: string;
}

export type { PromptPackContract } from "./contracts";
