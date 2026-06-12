import type { IdeaRequestContract } from "./types";
import type { MatrixBuilderClient } from "./client";

export function parseIdea(client: MatrixBuilderClient, payload: IdeaRequestContract) {
  return client.post("/api/v1/ideas/parse", payload);
}
