export type CoderId = "claude-code" | "codex-chatgpt" | "cursor" | "gitpilot" | "ibm-bob" | "generic-ai-coder";

export interface AiCoder {
  id: CoderId;
  name: string;
  short: string;
  url: string;
  promptPath: string;
  handoff: string;
}
