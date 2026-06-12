import type { BlueprintCandidateContract, BlueprintResultContract, IdeaRequestContract } from "./types";
import type { MatrixBuilderClient } from "./client";

export interface BlueprintCandidateResponse {
  candidates: BlueprintCandidateContract[];
}

export function getBlueprintCandidates(client: MatrixBuilderClient, payload: IdeaRequestContract) {
  return client.post<BlueprintCandidateResponse, IdeaRequestContract>("/api/v1/blueprints/candidates", payload);
}

export function generateBlueprint(client: MatrixBuilderClient, payload: IdeaRequestContract) {
  return client.post<BlueprintResultContract, IdeaRequestContract>("/api/v1/blueprints", payload);
}
