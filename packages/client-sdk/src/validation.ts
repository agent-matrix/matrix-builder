import type { ValidationReportContract } from "./types";
import type { MatrixBuilderClient } from "./client";

export function createValidationReport(client: MatrixBuilderClient, bundleId?: string) {
  return client.post<ValidationReportContract, { bundle_id?: string }>("/api/v1/validation/reports", { bundle_id: bundleId });
}
