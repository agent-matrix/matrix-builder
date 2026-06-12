import type { PromptPackContract } from "./types";
import type { MatrixBuilderClient } from "./client";

export function getPrompt(client: MatrixBuilderClient, coder: string) {
  return client.get(`/api/v1/prompts/${coder}`);
}

export type { PromptPackContract };
