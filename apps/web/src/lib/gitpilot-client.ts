import { apiBaseUrl } from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Cloud GitPilot run (Batches 5 & 6).
//
// These talk to the Matrix Builder backend (not the browser → GitPilot). The
// backend signs the bundle URL and holds the A2A secret; the browser only sees
// run ids, statuses, and MB-relative diff/logs URLs. So: no secrets client-side.
// ---------------------------------------------------------------------------

export interface CloudRunRequest {
  task_id?: string;
  prompt?: string;
  project_name?: string;
  allowed_files?: string[];
  forbidden_files?: string[];
  validation_commands?: string[];
  mode?: string;
}

export interface CloudRunResult {
  run_id: string;
  status: string;
  url: string;
}

export interface CloudRunStatus {
  run_id: string;
  status: string;
  summary: string;
  diff_url: string | null;
  logs_url: string | null;
  test_status: string;
  changed_files: string[];
}

const CLOUD_TERMINAL = new Set(["completed", "blocked", "error", "needs_approval"]);

export function isCloudRunTerminal(status: string): boolean {
  return CLOUD_TERMINAL.has(status);
}

// Start a cloud GitPilot run for a bundle via the Matrix Builder backend.
export async function createCloudRun(bundleId: string, body: CloudRunRequest = {}): Promise<CloudRunResult> {
  const resp = await fetch(`${apiBaseUrl}/api/v1/bundles/${bundleId}/gitpilot/runs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`GitPilot run create failed (${resp.status})`);
  return (await resp.json()) as CloudRunResult;
}

// Poll a cloud GitPilot run's result via the Matrix Builder backend.
export async function getCloudRun(runId: string): Promise<CloudRunStatus> {
  const resp = await fetch(`${apiBaseUrl}/api/v1/gitpilot/runs/${runId}`);
  if (!resp.ok) throw new Error(`GitPilot run status failed (${resp.status})`);
  return (await resp.json()) as CloudRunStatus;
}

// Absolute URL for a proxied diff/logs link the browser can open. `path` is the
// MB-relative URL returned in the run status (e.g. /api/v1/gitpilot/runs/x/diff).
export function cloudArtifactUrl(path: string | null): string | null {
  if (!path) return null;
  return `${apiBaseUrl}${path}`;
}

// --- Validation gate + repair loop (Batches 7 & 8) -------------------------

export interface CommitGate {
  status: string;
  can_commit: boolean;
  can_repair: boolean;
  blocked: boolean;
}

export interface ValidationViolation {
  rule_id: string;
  severity: string;
  message: string;
  path?: string | null;
  remediation?: string | null;
}

export interface CloudValidationResult {
  run_id: string;
  gate: CommitGate;
  report: {
    status: string;
    score: number;
    violations: ValidationViolation[];
    repair_prompt: string | null;
    summary?: string;
  };
}

// Feed a GitPilot run's diff into Matrix validation. The verdict drives the gate.
export async function validateCloudRun(bundleId: string, runId: string): Promise<CloudValidationResult> {
  const resp = await fetch(`${apiBaseUrl}/api/v1/bundles/${bundleId}/gitpilot/runs/${runId}/validate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  if (!resp.ok) throw new Error(`Matrix validation failed (${resp.status})`);
  return (await resp.json()) as CloudValidationResult;
}

export interface RepairDispatch {
  validation_findings?: string[];
  repair_prompt?: string;
  allowed_files?: string[];
  forbidden_files?: string[];
}

// Dispatch a repair to GitPilot; returns the new child run to poll + re-validate.
export async function repairCloudRun(
  bundleId: string,
  runId: string,
  body: RepairDispatch,
): Promise<CloudRunResult> {
  const resp = await fetch(`${apiBaseUrl}/api/v1/bundles/${bundleId}/gitpilot/runs/${runId}/repair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`GitPilot repair failed (${resp.status})`);
  return (await resp.json()) as CloudRunResult;
}

// Turn a validation report into repair findings (rule + message) for GitPilot.
export function findingsFromReport(report: CloudValidationResult["report"]): string[] {
  return report.violations.map((v) => `${v.rule_id}: ${v.message}`);
}

// --- PR flow + diff viewer (Batch 11) --------------------------------------

export interface PrRequest {
  repo_url?: string;
  title?: string;
  base?: string;
}

export interface PrResult {
  run_id: string;
  pr_url: string | null;
  status: string;
  message: string;
}

// Open a PR for an approved run (gated server-side on the Matrix verdict).
export async function openPr(bundleId: string, runId: string, body: PrRequest = {}): Promise<PrResult> {
  const resp = await fetch(`${apiBaseUrl}/api/v1/bundles/${bundleId}/gitpilot/runs/${runId}/pr`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (resp.status === 409) {
    throw new Error("Matrix approval required before opening a PR.");
  }
  if (!resp.ok) throw new Error(`Open PR failed (${resp.status})`);
  return (await resp.json()) as PrResult;
}

// Fetch the proxied diff text for a run (MB-relative path from the run status).
export async function fetchDiffText(diffPath: string): Promise<string> {
  const url = cloudArtifactUrl(diffPath);
  if (!url) return "";
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Fetch diff failed (${resp.status})`);
  return await resp.text();
}

export type DiffLineKind = "add" | "del" | "hunk" | "meta" | "context";
export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

// Classify each line of a unified diff so a viewer can colour them. Pure +
// dependency-free (the web app keeps a minimal footprint — no Monaco/highlighter).
export function parseDiffLines(diff: string): DiffLine[] {
  return (diff || "").split("\n").map((text) => {
    if (text.startsWith("@@")) return { kind: "hunk", text };
    if (/^(diff |index |--- |\+\+\+ |new file|deleted file|rename )/.test(text)) {
      return { kind: "meta", text };
    }
    if (text.startsWith("+")) return { kind: "add", text };
    if (text.startsWith("-")) return { kind: "del", text };
    return { kind: "context", text };
  });
}

// Local GitPilot bridge (Batch 3).
//
// Talks to a GitPilot the user runs on their own machine (default
// http://localhost:8000). The flow is: probe the Matrix bridge health, and if
// it's up, POST the Matrix run. We hand GitPilot only the signed bundle URL and
// the controlled prompt — GitPilot re-applies the Matrix guardrails on its side
// (it can never edit the control files, approve its own work, or commit). If the
// local server isn't running we fail gracefully so the caller can show a toast.
//
// Endpoints match GitPilot's Matrix facade. GitPilot exposes the same handler
// under both /api/v1/gitpilot/* (cloud) and /api/matrix/* (local bridge); we use
// the /api/matrix/* namespace here, per the Phase 2 contract.

export const DEFAULT_LOCAL_GITPILOT_URL = "http://localhost:8000";

export function stripTrailingSlash(url: string): string {
  return String(url || "").replace(/\/+$/, "");
}

// Base URL for the user's local GitPilot. Override with
// NEXT_PUBLIC_LOCAL_GITPILOT_URL for a non-default host/port.
export function localGitPilotBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_LOCAL_GITPILOT_URL;
  return stripTrailingSlash(raw && raw.trim() ? raw : DEFAULT_LOCAL_GITPILOT_URL);
}

export function localHealthUrl(base: string): string {
  return `${stripTrailingSlash(base)}/api/matrix/health`;
}

export function localRunsUrl(base: string): string {
  return `${stripTrailingSlash(base)}/api/matrix/runs`;
}

// The Matrix run contract GitPilot's facade accepts. `coder`/`source` are
// advisory metadata; the rest mirror the signed bundle's contract.
export interface MatrixRunPayload {
  bundle_url: string;
  project_name: string;
  task_id: string;
  prompt: string;
  allowed_files: string[];
  forbidden_files: string[];
  validation_commands: string[];
  mode: string;
  coder: "gitpilot";
  source: "matrix-builder";
}

export interface MatrixRunResult {
  run_id: string;
  status: string;
  url: string;
}

export interface BuildPayloadInput {
  bundleUrl: string;
  projectName: string;
  taskId: string;
  prompt: string;
  allowedFiles: readonly string[];
  forbiddenFiles: readonly string[];
  validationCommands: readonly string[];
  mode?: string;
}

export function buildMatrixRunPayload(input: BuildPayloadInput): MatrixRunPayload {
  return {
    bundle_url: input.bundleUrl,
    project_name: input.projectName,
    task_id: input.taskId,
    prompt: input.prompt,
    allowed_files: [...input.allowedFiles],
    forbidden_files: [...input.forbiddenFiles],
    validation_commands: [...input.validationCommands],
    mode: input.mode ?? "ask",
    coder: "gitpilot",
    source: "matrix-builder",
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// True iff a local GitPilot Matrix bridge answers a healthy response. Never
// throws — any network error / timeout / non-200 means "not running".
export async function probeLocalGitPilot(
  base: string = localGitPilotBaseUrl(),
  timeoutMs = 1500,
): Promise<boolean> {
  try {
    const resp = await fetchWithTimeout(localHealthUrl(base), { method: "GET" }, timeoutMs);
    if (!resp.ok) return false;
    const body = (await resp.json().catch(() => null)) as { status?: string } | null;
    // Accept an explicit {status:"ok"} or any 200 without a contradicting status.
    return body?.status ? body.status === "ok" : true;
  } catch {
    return false;
  }
}

// POST the Matrix run to the local GitPilot. Throws on a non-2xx / network error
// so the caller can surface a precise message.
export async function sendToLocalGitPilot(
  payload: MatrixRunPayload,
  base: string = localGitPilotBaseUrl(),
  timeoutMs = 15000,
): Promise<MatrixRunResult> {
  const resp = await fetchWithTimeout(
    localRunsUrl(base),
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    },
    timeoutMs,
  );
  if (!resp.ok) {
    throw new Error(`Local GitPilot error ${resp.status}`);
  }
  return (await resp.json()) as MatrixRunResult;
}
