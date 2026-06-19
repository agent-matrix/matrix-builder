// C0 — Client state model for the Blueprint Details workspace.
//
// One state object is the single source of truth for the live workspace. It is produced and
// mutated entirely in the browser by `blueprint-engine.ts` (no network on the render path);
// the server and the LLM are optional progressive enhancements layered on top.

export interface ArchitectureNode {
  name: string;
  description: string;
  dependencies: string[];
}
export interface FilePlanItem {
  path: string;
  description: string;
}
export interface DesignerBatch {
  id: string;
  name: string;
  purpose: string;
  tasks: string[];
  allowed_files: string[];
  depends_on: string[];
  acceptance_criteria: string[];
  validation_checks: string[];
  must_not_change: string[];
}
export interface DesignerChatMessage {
  id: string;
  role: "user" | "blueprint";
  content: string;
  timestamp: string;
}
export interface BlueprintDetailsData {
  candidate_id: string;
  overview: string;
  architecture: ArchitectureNode[];
  batches: DesignerBatch[];
  file_plan: FilePlanItem[];
  matrix_rules: string[];
  acceptance_criteria: string[];
  validation_plan: string[];
  risks: string[];
  assumptions: string[];
  design_brain?: string | null;
  chat_history: DesignerChatMessage[];
}

export interface DesignerCandidate {
  id: string;
  tier: string;
  title: string;
  summary: string;
  file_count: number;
  difficulty: string;
  estimate: string;
  stack: string[];
  recommended: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "blueprint";
  content: string;
  time?: string;
}

/** Which sections an engine `apply()` touched — lets the UI know what changed. */
export type BlueprintSection = "overview" | "architecture" | "filePlan" | "batches" | "designBrain";

/** The single source of truth for the live workspace (held by `useBlueprintWorkspace`). */
export interface BlueprintWorkspaceState {
  candidateId: string;
  idea: string;
  data: BlueprintDetailsData;
  messages: ChatMessage[];
  dirty: boolean;
  busy: boolean;
}

export const RMD_RULES = [
  "RMD-101: AI coders are workers, not architects.",
  "RMD-103: Control files are protected.",
  "RMD-111: Acceptance criteria are law.",
];
