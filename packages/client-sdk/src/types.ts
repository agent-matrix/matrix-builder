export type BuildType = "app" | "agent" | "api";
export type Goal = "portfolio" | "startup-mvp" | "internal-tool" | "learning" | "open-source" | "enterprise";
export type QualityLevel = "starter" | "standard" | "production" | "enterprise";
export type ContractCoderId = "claude-code" | "codex-chatgpt" | "cursor" | "gitpilot" | "ibm-bob" | "generic-ai-coder";
export type ValidationStatus = "not-run" | "approved" | "needs-repair" | "rejected";
export type BundleStatus = "draft" | "ready" | "expired" | "archived" | "saved";

export interface BundleTreeNodeContract {
  path: string;
  kind: string;
  required: boolean;
  size_bytes?: number | null;
  digest?: string | null;
}

export interface IdeaConstraints {
  preferred_stack: string[];
  forbidden_stack: string[];
  deployment_target: "local" | "docker" | "cloud" | "kubernetes";
  requires_auth: boolean;
  data_sensitivity: "public" | "internal" | "confidential";
}

export interface IdeaRequestContract {
  schema_version: "matrix.builder.idea/v1";
  idea: string;
  build_type: BuildType;
  goal: Goal;
  preferred_coder: ContractCoderId;
  quality_level: QualityLevel;
  constraints: IdeaConstraints;
  metadata: {
    source: string;
    locale: string;
    request_id?: string;
  };
}

export interface BlueprintCandidateContract {
  candidate_id: string;
  title: string;
  slug: string;
  summary: string;
  quality_level: QualityLevel;
  recommended: boolean;
  stack: string[];
  estimated_files: number;
  estimated_effort: string;
  difficulty: "easy" | "medium" | "hard";
  standards_profile: string;
  rationale: string;
  generator_actions: string[];
  validation_checks: string[];
}

export interface ApiRouteContract {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  summary?: string;
  auth_required: boolean;
}

export interface BlueprintResultContract {
  blueprint_id: string;
  candidate_id: string;
  name: string;
  slug: string;
  idea: string;
  quality_level: QualityLevel;
  stack: {
    frontend: string;
    backend: string;
    worker?: string | null;
    database?: string | null;
    auth: "none" | "session" | "oauth2" | "enterprise-sso";
    deploy: "local" | "docker" | "cloud" | "kubernetes";
  };
  pages: string[];
  services: string[];
  api_routes: ApiRouteContract[];
  required_files: string[];
  allowed_change_roots: string[];
  forbidden_changes: string[];
  tasks: Array<{
    task_id: string;
    title: string;
    allowed_files: string[];
    acceptance_criteria: string[];
  }>;
  acceptance_commands: string[];
  standards_lock_ref: string;
}

export interface BundleFileContract {
  path: string;
  kind: "control" | "source" | "test" | "doc" | "prompt" | "config" | "manifest" | "artifact";
  required: boolean;
  content_type: string;
  digest?: string | null;
}

export interface MatrixBundleContract {
  bundle_id: string;
  blueprint_id: string;
  status: BundleStatus;
  title: string;
  created_at?: string | null;
  expires_at?: string | null;
  bundle_url?: string | null;
  download_url?: string | null;
  signed_download_url?: string | null;
  manifest_url?: string | null;
  manifest_digest?: string | null;
  zip_digest?: string | null;
  zip_size_bytes?: number | null;
  file_count?: number | null;
  persisted: boolean;
  owner_id?: string | null;
  storage_uri?: string | null;
  expires_in_seconds: number;
  files: BundleFileContract[];
  tree: BundleTreeNodeContract[];
  prompts_available: ContractCoderId[];
  standards: string[];
  validation: ValidationStatus;
  links: Record<string, string>;
}

export interface PromptPackContract {
  prompt_pack_id: string;
  bundle_id: string;
  blueprint_id: string;
  default_coder: ContractCoderId;
  prompts: Array<{
    coder: ContractCoderId;
    label: string;
    path: string;
    content: string;
    contract_files: string[];
    allowed_files: string[];
    validation_commands: string[];
    hard_constraints: string[];
  }>;
}

export interface PromptResponseContract {
  coder: ContractCoderId | string;
  label: string;
  path: string;
  prompt: string;
  bundle_id?: string | null;
  bundle_url?: string | null;
  task_id: string;
  contract_files: string[];
  allowed_files: string[];
  validation_commands: string[];
  hard_constraints: string[];
  handoff_mode?: string | null;
}

export interface ValidationRequestContract {
  schema_version: "matrix.builder.validation-request/v1";
  bundle_id?: string | null;
  mode: "bundle" | "patch" | "repository" | "dry-run";
  changed_files: Array<{ path: string; status: "added" | "modified" | "deleted" | "renamed"; digest?: string | null }>;
  dependency_changes: Array<{ ecosystem: string; name: string; action: "added" | "updated" | "removed"; version?: string | null; approved: boolean }>;
  artifacts: Array<{ kind: string; path: string; digest?: string | null; verified: boolean }>;
  standards_lock_digest?: string | null;
  matrix_blueprint_digest?: string | null;
  repository_archive_ref?: string | null;
  patch_ref?: string | null;
  metadata: Record<string, unknown>;
}

export interface ValidationReportContract {
  report_id: string;
  bundle_id: string;
  status: ValidationStatus;
  score: number;
  violations: Array<{
    rule_id: string;
    severity: "info" | "low" | "medium" | "high" | "critical";
    path?: string | null;
    message: string;
    remediation?: string | null;
  }>;
  repair_prompt?: string | null;
  checks: Array<{
    check_id: string;
    status: "passed" | "failed" | "skipped";
    message?: string | null;
  }>;
  approved?: boolean;
  matrixhub_publishable?: boolean;
  summary?: string | null;
  created_at?: string;
}

export interface PublicationContract {
  publication_id: string;
  bundle_id: string;
  target: "matrixhub";
  dry_run: boolean;
  status: "accepted" | "rejected" | "pending" | "not-connected";
  accepted?: boolean;
  matrixhub_slug?: string | null;
  required_artifacts: string[];
  missing_artifacts?: string[];
  validation_status?: string | null;
  validation_report_id?: string | null;
  trust_status: "unverified" | "verified" | "dry-run";
  message: string;
}


export interface BundleManifestContract {
  schema_version: "matrix.builder.bundle-manifest/v1";
  bundle_id: string;
  blueprint_id: string;
  title: string;
  created_at: string;
  expires_at?: string | null;
  status: BundleStatus;
  manifest_digest: string;
  zip_digest: string;
  zip_size_bytes: number;
  file_count: number;
  files: BundleFileContract[];
  prompts_available: ContractCoderId[];
  standards: string[];
  storage_uri: string;
  checksums: Record<string, string>;
  metadata: Record<string, unknown>;
}

export interface SignedBundleUrlContract {
  bundle_id: string;
  url: string;
  expires_at: string;
  expires_in_seconds: number;
}
