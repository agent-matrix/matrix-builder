// Types mirroring the Matrix Builder /v1 workflow API (Batches C2/C3/C4).

export type ChangeType = "small-update" | "add-feature" | "fix-issue";

export type WorkflowStatus =
  | "draft"
  | "ready"
  | "running"
  | "committed"
  | "approved"
  | "needs-repair"
  | "rejected"
  | "not-run"
  | "active"
  | "failed";

export interface VersionResponse {
  id: string;
  project_id: string;
  parent_version_id: string | null;
  version_label: string;
  title: string;
  requirements_md: string;
  status: string;
  created_at: string;
}

export interface BatchResponse {
  id: string;
  version_id: string;
  ordinal: number;
  title: string;
  goal_md: string;
  change_type: ChangeType;
  status: string;
  parent_commit_id: string | null;
  created_at: string;
}

export interface PromptPackResponse {
  batch_id: string;
  prompt_version_id: string;
  coder: string;
  prompt_text: string;
  constraints: Record<string, unknown>;
  batch_status: string;
}

export interface TimelineEntry {
  kind: "batch" | "commit" | "run";
  id: string;
  ordinal: number | null;
  commit_no: number | null;
  title: string;
  status: string;
  ui_label: string | null;
  created_at: string;
}

export interface TimelineResponse {
  version_id: string;
  version_label: string;
  entries: TimelineEntry[];
}

export interface ValidationFinding {
  id: string;
  severity: string;
  status: string;
  check_name: string;
  file_path: string | null;
  message: string;
  remediation: string | null;
}

export interface ValidationRunResponse {
  id: string;
  commit_id: string | null;
  status: string;
  ui_label: string;
  score: number | null;
  runner: string;
  findings: ValidationFinding[];
}

export interface RunEvent {
  seq: number;
  run_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string | null;
}

// --- Projects / Versions (the persistent home of a "build") -------------------------------

export interface ProjectResponse {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  description: string;
  status: string;
  privacy: string;
  created_at: string;
}

export interface ProjectCreate {
  title: string;
  slug: string;
  description?: string;
}

export interface VersionCreate {
  project_id: string;
  title: string;
  version_label?: string;
  requirements_md?: string;
  parent_version_id?: string | null;
}

// --- Execution: submit what the AI coder changed; commit + validate in one call ------------

export interface ChangedFile {
  path: string;
  change_type?: "added" | "modified" | "deleted";
}

export interface DependencyChange {
  name: string;
  version?: string | null;
  action?: "added" | "removed" | "updated";
}

export interface ExecutionRequest {
  coder?: string;
  changed_files?: ChangedFile[];
  dependency_changes?: DependencyChange[];
  patch?: string | null;
  summary?: string;
}

export interface ExecutionResponse {
  commit: CommitResponse;
  validation_run: ValidationRunResponse;
  outcome: string;
  next_action: string;
}

// --- Async runs (enqueue + stream events) -------------------------------------------------

export interface RunResponse {
  id: string;
  batch_id: string | null;
  commit_id: string | null;
  status: string;
  ui_label: string;
  score: number | null;
  runner: string;
}

export interface RunEnqueueResponse {
  run_id: string;
  status: string;
  ui_label: string;
  events_url: string;
  ws_url: string;
}

export interface RepairBatchRequest {
  validation_run_id: string;
  coder?: string;
}

// --- Commits, diffs and artifacts (the immutable record of an accepted change) -------------

export interface CommitResponse {
  id: string;
  version_id: string;
  batch_id: string;
  commit_no: number;
  summary: string;
  tree_hash: string;
  validation_status: string;
  ui_label: string;
  parent_commit_id: string | null;
  created_at: string;
}

export interface CommitDiffResponse {
  base_commit_id: string | null;
  head_commit_id: string;
  patch: string;
}

export interface ArtifactResponse {
  id: string;
  artifact_type: string;
  storage_key: string;
  sha256: string;
  size_bytes: number;
}

// --- Generation (idea → candidates → bundle), normalized to the API contract --------------

export interface IdeaIntentResponse {
  normalized_idea: string;
  build_type: string;
  goal: string;
  preferred_coder: string;
  quality_level?: string;
  constraints?: Record<string, unknown>;
}

export const CHANGE_TYPES: { id: ChangeType; label: string; hint: string }[] = [
  { id: "small-update", label: "Small update", hint: "A focused tweak inside the current version." },
  { id: "add-feature", label: "Add feature", hint: "A new capability, scoped to one batch." },
  { id: "fix-issue", label: "Fix issue", hint: "Repair behaviour without changing the contract." },
];

// --- Import existing plan (Batches 3–5): document brief + blueprint JSON ---
export type ProjectBriefContract = {
  schema_version: string;
  source_type: "idea" | "document" | "design" | "template";
  title: string;
  summary: string;
  domain?: string | null;
  goals: string[];
  users: string[];
  features: string[];
  screens: string[];
  integrations: string[];
  constraints: string[];
  risks: string[];
  non_functional: string[];
  source_files: string[];
  enhanced_by: "deterministic" | "ollabridge";
  // Optional, set only when OllaBridge enhances the brief (Batch 7, Seam 1).
  missingQuestions?: string[];
  confidence?: number;
};

export type IngestDocumentResponse = {
  source_type: string;
  filename: string;
  markdown: string;
  brief: ProjectBriefContract;
  idea: string;
};

export type BlueprintImportResponse = {
  valid: boolean;
  errors: string[];
  blueprint: unknown | null;
};
