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

export const CHANGE_TYPES: { id: ChangeType; label: string; hint: string }[] = [
  { id: "small-update", label: "Small update", hint: "A focused tweak inside the current version." },
  { id: "add-feature", label: "Add feature", hint: "A new capability, scoped to one batch." },
  { id: "fix-issue", label: "Fix issue", hint: "Repair behaviour without changing the contract." },
];
