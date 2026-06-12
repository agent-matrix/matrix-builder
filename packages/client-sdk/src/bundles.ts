import type { MatrixBundleContract } from "./types";
import type { MatrixBuilderClient } from "./client";

export function getBundle(client: MatrixBuilderClient, bundleId: string) {
  return client.get<MatrixBundleContract>(`/api/v1/bundles/${bundleId}`);
}
