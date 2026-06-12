import type {
  BlueprintCandidateContract,
  BlueprintResultContract,
  ContractCoderId,
  IdeaRequestContract,
  MatrixBundleContract,
  ValidationReportContract,
} from "../types/contracts";

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Matrix Builder API error ${response.status}`);
  return (await response.json()) as T;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (!response.ok) throw new Error(`Matrix Builder API error ${response.status}`);
  return (await response.json()) as T;
}

export function getHealth(): Promise<Response> {
  return fetch(`${apiBaseUrl}/health`);
}

export function parseIdea(payload: Partial<IdeaRequestContract>) {
  return postJson("/api/v1/ideas/parse", payload);
}

export function getBlueprintCandidates(payload: Partial<IdeaRequestContract>) {
  return postJson<{ candidates: BlueprintCandidateContract[] }>(
    "/api/v1/blueprints/candidates",
    payload,
  );
}

export function generateBlueprint(payload: Partial<IdeaRequestContract>) {
  return postJson<BlueprintResultContract>("/api/v1/blueprints", payload);
}

export function generateBundle(
  ideaRequest: Partial<IdeaRequestContract>,
  preferredCoder: ContractCoderId,
  candidateId?: string,
) {
  return postJson<MatrixBundleContract>("/api/v1/bundles", {
    idea_request: ideaRequest,
    preferred_coder: preferredCoder,
    candidate_id: candidateId,
  });
}

export function getBundle(bundleId: string) {
  return getJson<MatrixBundleContract>(`/api/v1/bundles/${bundleId}`);
}

export function getBundlePrompt(bundleId: string, coder: ContractCoderId) {
  return getJson<{ coder: ContractCoderId; prompt: string; contract_files: string[] }>(
    `/api/v1/bundles/${bundleId}/prompt/${coder}`,
  );
}

export function validateBundle(bundleId: string) {
  return postJson<ValidationReportContract>(`/api/v1/bundles/${bundleId}/validate`, {});
}
