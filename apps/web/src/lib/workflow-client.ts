// Authenticated client for the Matrix Builder /v1 workflow API (Batches C2/C3/C4).

import { apiBaseUrl } from "./api-client";
import { authHeaders } from "./auth-token";
import type {
  BatchResponse,
  ChangeType,
  PromptPackResponse,
  TimelineResponse,
  ValidationRunResponse,
  VersionResponse,
  RunEvent,
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
  return (await response.json()) as T;
}

export function getVersion(versionId: string): Promise<VersionResponse> {
  return request(`/api/v1/versions/${versionId}`);
}

export function getTimeline(versionId: string): Promise<TimelineResponse> {
  return request(`/api/v1/versions/${versionId}/timeline`);
}

export function createBatch(
  versionId: string,
  goalMd: string,
  changeType: ChangeType,
): Promise<BatchResponse> {
  return request(`/api/v1/batches`, {
    method: "POST",
    body: JSON.stringify({ version_id: versionId, goal_md: goalMd, change_type: changeType }),
  });
}

export function generatePromptPack(batchId: string, coder: string): Promise<PromptPackResponse> {
  return request(`/api/v1/batches/${batchId}/prompt-pack`, {
    method: "POST",
    body: JSON.stringify({ coder }),
  });
}

export function getValidationRun(runId: string): Promise<ValidationRunResponse> {
  return request(`/api/v1/validation-runs/${runId}`);
}

export function getRunEvents(runId: string, after = 0): Promise<RunEvent[]> {
  return request(`/api/v1/runs/${runId}/events?after=${after}`);
}

export function createRepairBatch(runId: string, coder: string): Promise<PromptPackResponse> {
  return request(`/api/v1/repair-batches`, {
    method: "POST",
    body: JSON.stringify({ validation_run_id: runId, coder }),
  });
}

// Thumbnails are owner-scoped; fetch with auth and inline the SVG markup.
export async function fetchThumbnail(versionId: string): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/api/v1/versions/${versionId}/thumbnail.svg`, {
    headers: { ...authHeaders() },
  });
  if (!response.ok) throw new WorkflowApiError(response.status, "thumbnail unavailable");
  return response.text();
}
