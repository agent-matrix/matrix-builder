// Authenticated client for the Matrix Builder /v1 workflow + generation API.
//
// Every call carries the self-issued session JWT (Authorization: Bearer …) via authHeaders(),
// so each UI action maps to exactly one typed, owner-scoped request. This is the single client
// the build screens should reach for; api-client.ts (unauthenticated) is being retired.

import { apiBaseUrl } from "./api-client";
import { authHeaders } from "./auth-token";
import type {
  BlueprintCandidateContract,
  BlueprintResultContract,
  ContractCoderId,
  IdeaRequestContract,
  MatrixBundleContract,
  PromptResponseContract,
  ValidationReportContract,
} from "../types/contracts";
import type {
  ArtifactResponse,
  BatchResponse,
  BlueprintImportResponse,
  ChangeType,
  CommitDiffResponse,
  CommitResponse,
  ExecutionRequest,
  ExecutionResponse,
  IdeaIntentResponse,
  IngestDocumentResponse,
  ProjectCreate,
  ProjectResponse,
  PromptPackResponse,
  RunEnqueueResponse,
  RunEvent,
  RunResponse,
  TimelineResponse,
  ValidationRunResponse,
  VersionCreate,
  VersionResponse,
} from "./workflow-types";

export class WorkflowApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "WorkflowApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    let detail = `Workflow API error ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      // non-JSON error body; keep the default message
    }
    throw new WorkflowApiError(response.status, detail);
  }
  // 204/empty bodies are valid for some endpoints; tolerate them.
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
}

// --- Projects -----------------------------------------------------------------------------

export function createProject(payload: ProjectCreate): Promise<ProjectResponse> {
  return post(`/api/v1/projects`, payload);
}

export function listProjects(): Promise<ProjectResponse[]> {
  return request(`/api/v1/projects`);
}

export function getProject(projectId: string): Promise<ProjectResponse> {
  return request(`/api/v1/projects/${projectId}`);
}

// --- Versions -----------------------------------------------------------------------------

export function createVersion(payload: VersionCreate): Promise<VersionResponse> {
  return post(`/api/v1/versions`, payload);
}

export function getVersion(versionId: string): Promise<VersionResponse> {
  return request(`/api/v1/versions/${versionId}`);
}

export function getTimeline(versionId: string): Promise<TimelineResponse> {
  return request(`/api/v1/versions/${versionId}/timeline`);
}

// --- Batches ------------------------------------------------------------------------------

export function createBatch(
  versionId: string,
  goalMd: string,
  changeType: ChangeType,
  title?: string,
): Promise<BatchResponse> {
  return post(`/api/v1/batches`, {
    version_id: versionId,
    goal_md: goalMd,
    change_type: changeType,
    ...(title ? { title } : {}),
  });
}

export function getBatch(batchId: string): Promise<BatchResponse> {
  return request(`/api/v1/batches/${batchId}`);
}

export function generatePromptPack(batchId: string, coder: string): Promise<PromptPackResponse> {
  return post(`/api/v1/batches/${batchId}/prompt-pack`, { coder });
}

// --- Execution: submit what the coder changed (commit + validate in one call) --------------

export function submitExecution(
  batchId: string,
  payload: ExecutionRequest,
): Promise<ExecutionResponse> {
  return post(`/api/v1/batches/${batchId}/executions`, payload);
}

// --- Async runs (enqueue, then poll/stream events) -----------------------------------------

export function enqueueRun(batchId: string, payload: ExecutionRequest): Promise<RunEnqueueResponse> {
  return post(`/api/v1/batches/${batchId}/runs`, payload);
}

export function getRun(runId: string): Promise<RunResponse> {
  return request(`/api/v1/runs/${runId}`);
}

export function getRunEvents(runId: string, after = 0): Promise<RunEvent[]> {
  return request(`/api/v1/runs/${runId}/events?after=${after}`);
}

export function getValidationRun(runId: string): Promise<ValidationRunResponse> {
  return request(`/api/v1/validation-runs/${runId}`);
}

export function createRepairBatch(runId: string, coder: string): Promise<PromptPackResponse> {
  return post(`/api/v1/repair-batches`, { validation_run_id: runId, coder });
}

// --- Commits, diffs and artifacts (the immutable record of an accepted change) -------------

export function getCommit(commitId: string): Promise<CommitResponse> {
  return request(`/api/v1/commits/${commitId}`);
}

export function getCommitDiff(commitId: string): Promise<CommitDiffResponse> {
  return request(`/api/v1/commits/${commitId}/diff`);
}

export function getCommitArtifacts(commitId: string): Promise<ArtifactResponse[]> {
  return request(`/api/v1/commits/${commitId}/artifacts`);
}

// --- Generation (idea → candidates → bundle), now auth-headered too ------------------------

export function parseIdea(payload: Partial<IdeaRequestContract>): Promise<IdeaIntentResponse> {
  return post(`/api/v1/ideas/parse`, payload);
}

export function getBlueprintCandidates(
  payload: Partial<IdeaRequestContract>,
): Promise<{ candidates: BlueprintCandidateContract[] }> {
  return post(`/api/v1/blueprints/candidates`, payload);
}

export function generateBlueprint(
  payload: Partial<IdeaRequestContract>,
  candidateId?: string,
): Promise<BlueprintResultContract> {
  return post(`/api/v1/blueprints/generate`, {
    idea_request: payload,
    ...(candidateId ? { candidate_id: candidateId } : {}),
  });
}

export function generateBundle(
  ideaRequest: Partial<IdeaRequestContract>,
  preferredCoder: ContractCoderId,
  candidateId?: string,
): Promise<MatrixBundleContract> {
  return post(`/api/v1/bundles`, {
    idea_request: ideaRequest,
    preferred_coder: preferredCoder,
    ...(candidateId ? { candidate_id: candidateId } : {}),
  });
}

// --- Import existing plan: brief upload (Path B) and Blueprint JSON (Path C, skip-AI) ----------

// Upload a PDF/DOCX/Markdown/TXT brief; returns a deterministic ProjectBrief + a derived idea.
export async function ingestDocument(file: File): Promise<IngestDocumentResponse> {
  const form = new FormData();
  form.append("file", file);
  // No content-type header: the browser sets the multipart boundary.
  const response = await fetch(`${apiBaseUrl}/api/v1/ingest/document`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: form,
  });
  if (!response.ok) {
    let detail = `Upload failed (${response.status})`;
    try { const b = (await response.json()) as { detail?: string }; if (b?.detail) detail = b.detail; } catch { /* keep default */ }
    throw new WorkflowApiError(response.status, detail);
  }
  return (await response.json()) as IngestDocumentResponse;
}

// Validate a complete Blueprint JSON against the contract (no AI). valid=false carries errors.
export function importBlueprint(blueprint: unknown): Promise<BlueprintImportResponse> {
  return post(`/api/v1/ingest/blueprint`, { blueprint });
}

// Compile a validated blueprint verbatim into a Matrix Bundle — AI skipped.
export function generateBundleFromBlueprint(
  blueprint: unknown,
  preferredCoder: ContractCoderId,
): Promise<MatrixBundleContract> {
  return post(`/api/v1/bundles`, { blueprint, preferred_coder: preferredCoder });
}

export function getBundle(bundleId: string): Promise<MatrixBundleContract> {
  return request(`/api/v1/bundles/${bundleId}`);
}

export function getBundlePrompt(
  bundleId: string,
  coder: ContractCoderId,
): Promise<PromptResponseContract> {
  return request(`/api/v1/bundles/${bundleId}/prompt/${coder}`);
}

export function validateBundle(bundleId: string): Promise<ValidationReportContract> {
  return post(`/api/v1/bundles/${bundleId}/validate`, {});
}

// Validate a submitted patch (the files the AI coder changed) against the bundle's contract.
// Stateless and real (the metadata contract check) — returns findings/score without a DB-backed run.
export function validateChanges(
  bundleId: string,
  changedFiles: Array<{ path: string; status?: "added" | "modified" | "deleted" | "renamed" }>,
): Promise<ValidationReportContract> {
  return post(`/api/v1/validation/patch`, {
    bundle_id: bundleId,
    mode: "patch",
    changed_files: changedFiles.map((f) => ({ path: f.path, status: f.status ?? "modified" })),
  });
}

// The engine's bundle zip (byte-for-byte what the CLI ships). Fetched with auth so owner-scoped
// bundles download; returns the raw Blob for the browser to save.
export async function downloadBundleZip(bundleId: string): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}/api/v1/bundles/${bundleId}/download`, {
    headers: { ...authHeaders() },
  });
  if (!response.ok) throw new WorkflowApiError(response.status, "bundle download unavailable");
  return response.blob();
}

// Thumbnails are owner-scoped; fetch with auth and inline the SVG markup.
export async function fetchThumbnail(versionId: string): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/api/v1/versions/${versionId}/thumbnail.svg`, {
    headers: { ...authHeaders() },
  });
  if (!response.ok) throw new WorkflowApiError(response.status, "thumbnail unavailable");
  return response.text();
}
