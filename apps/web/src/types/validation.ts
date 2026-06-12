export type ValidationStatus = "not-run" | "approved" | "needs-repair" | "rejected";
export type ViolationSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface ValidationViolation {
  rule_id: string;
  severity: ViolationSeverity;
  path?: string | null;
  message: string;
  remediation?: string | null;
}

export interface ValidationCheck {
  check_id: string;
  status: "passed" | "failed" | "skipped";
  message?: string | null;
}

export interface ValidationReport {
  report_id: string;
  bundle_id: string;
  status: ValidationStatus;
  score: number;
  violations: ValidationViolation[];
  repair_prompt?: string | null;
  checks: ValidationCheck[];
  approved: boolean;
  matrixhub_publishable: boolean;
  summary?: string | null;
  created_at?: string | null;
}

export const demoValidationReports: ValidationReport[] = [
  {
    report_id: "val_approved_demo",
    bundle_id: "bundle_demo_standard",
    status: "approved",
    score: 100,
    violations: [],
    checks: [
      { check_id: "forbidden_file_changes_absent", status: "passed", message: "No Matrix control files changed." },
      { check_id: "dependency_drift_absent", status: "passed", message: "No unapproved dependency changes." }
    ],
    approved: true,
    matrixhub_publishable: true,
    summary: "Approved: the AI-coder output stayed inside the Matrix contract."
  },
  {
    report_id: "val_repair_demo",
    bundle_id: "bundle_demo_standard",
    status: "needs-repair",
    score: 80,
    violations: [
      {
        rule_id: "RMD-105",
        severity: "high",
        path: "npm:left-pad",
        message: "Unapproved dependency added.",
        remediation: "Remove the dependency or request explicit approval."
      }
    ],
    repair_prompt: "Repair only the dependency drift. Do not change architecture or Matrix control files.",
    checks: [{ check_id: "dependency_drift_absent", status: "failed", message: "npm:left-pad" }],
    approved: false,
    matrixhub_publishable: false,
    summary: "Needs repair: dependency drift must be fixed before approval."
  },
  {
    report_id: "val_rejected_demo",
    bundle_id: "bundle_demo_standard",
    status: "rejected",
    score: 30,
    violations: [
      {
        rule_id: "RMD-103",
        severity: "critical",
        path: "MATRIX_BLUEPRINT.yaml",
        message: "Immutable Matrix blueprint was modified.",
        remediation: "Restore the file from the original Matrix Bundle."
      }
    ],
    repair_prompt: "Restore MATRIX_BLUEPRINT.yaml from the Matrix Bundle. AI coders are workers, not architects.",
    checks: [{ check_id: "forbidden_file_changes_absent", status: "failed", message: "MATRIX_BLUEPRINT.yaml" }],
    approved: false,
    matrixhub_publishable: false,
    summary: "Rejected: critical Matrix contract drift was detected."
  }
];
