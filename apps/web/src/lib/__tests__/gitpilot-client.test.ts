// Unit tests for the local GitPilot bridge (Batch 3).
//
// Run with: npm run test  (node --test with type-stripping and the @/ alias resolver).
// Covers the pure URL/payload helpers and the probe/send behaviour against a
// stubbed fetch — including graceful failure when local GitPilot is down.

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  DEFAULT_LOCAL_GITPILOT_URL,
  buildMatrixRunPayload,
  cloudArtifactUrl,
  createCloudRun,
  fetchDiffText,
  findingsFromReport,
  getCloudRun,
  isCloudRunTerminal,
  localGitPilotBaseUrl,
  localHealthUrl,
  localRunsUrl,
  openPr,
  parseDiffLines,
  probeLocalGitPilot,
  repairCloudRun,
  sendToLocalGitPilot,
  stripTrailingSlash,
  validateCloudRun,
  type CloudValidationResult,
} from "@/lib/gitpilot-client";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("gitpilot-client · url helpers", () => {
  it("strips trailing slashes", () => {
    assert.equal(stripTrailingSlash("http://localhost:8000/"), "http://localhost:8000");
    assert.equal(stripTrailingSlash("http://localhost:8000///"), "http://localhost:8000");
  });

  it("builds the matrix bridge health + runs urls", () => {
    assert.equal(localHealthUrl("http://localhost:8000"), "http://localhost:8000/api/matrix/health");
    assert.equal(localRunsUrl("http://localhost:8000/"), "http://localhost:8000/api/matrix/runs");
  });

  it("defaults the base url to localhost:8000", () => {
    assert.equal(DEFAULT_LOCAL_GITPILOT_URL, "http://localhost:8000");
    assert.equal(localGitPilotBaseUrl(), "http://localhost:8000");
  });
});

describe("gitpilot-client · buildMatrixRunPayload", () => {
  it("maps the contract and tags coder/source", () => {
    const payload = buildMatrixRunPayload({
      bundleUrl: "https://api.ruslanmv.com/v1/matrix-bundles/b1",
      projectName: "Starter",
      taskId: "TASK-001",
      prompt: "do the thing",
      allowedFiles: ["src/**"],
      forbiddenFiles: ["MATRIX_STANDARDS.lock"],
      validationCommands: ["pytest -q"],
    });
    assert.equal(payload.bundle_url, "https://api.ruslanmv.com/v1/matrix-bundles/b1");
    assert.equal(payload.task_id, "TASK-001");
    assert.equal(payload.coder, "gitpilot");
    assert.equal(payload.source, "matrix-builder");
    assert.equal(payload.mode, "ask"); // default
    assert.deepEqual(payload.allowed_files, ["src/**"]);
    // Copies, not references to the readonly inputs.
    assert.deepEqual(payload.forbidden_files, ["MATRIX_STANDARDS.lock"]);
  });
});

describe("gitpilot-client · probeLocalGitPilot", () => {
  it("returns true on a healthy 200", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: "ok" }), { status: 200 })) as typeof fetch;
    assert.equal(await probeLocalGitPilot("http://localhost:8000", 200), true);
  });

  it("returns false on a non-200", async () => {
    globalThis.fetch = (async () => new Response("nope", { status: 404 })) as typeof fetch;
    assert.equal(await probeLocalGitPilot("http://localhost:8000", 200), false);
  });

  it("returns false (never throws) when the server is unreachable", async () => {
    globalThis.fetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;
    assert.equal(await probeLocalGitPilot("http://localhost:8000", 200), false);
  });
});

describe("gitpilot-client · sendToLocalGitPilot", () => {
  const payload = buildMatrixRunPayload({
    bundleUrl: "https://api.ruslanmv.com/v1/matrix-bundles/b1",
    projectName: "Starter",
    taskId: "TASK-001",
    prompt: "do the thing",
    allowedFiles: ["src/**"],
    forbiddenFiles: ["MATRIX_STANDARDS.lock"],
    validationCommands: ["pytest -q"],
  });

  it("posts the run and returns the queued result", async () => {
    let seenUrl = "";
    let seenBody: unknown = null;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seenUrl = url;
      seenBody = JSON.parse(String(init.body));
      return new Response(
        JSON.stringify({ run_id: "gp-run-abc", status: "queued", url: "http://localhost:8000/api/v1/gitpilot/runs/gp-run-abc" }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await sendToLocalGitPilot(payload, "http://localhost:8000");
    assert.equal(seenUrl, "http://localhost:8000/api/matrix/runs");
    assert.deepEqual((seenBody as { coder: string }).coder, "gitpilot");
    assert.equal(result.run_id, "gp-run-abc");
    assert.equal(result.status, "queued");
  });

  it("throws on a non-2xx so the caller can show a graceful message", async () => {
    globalThis.fetch = (async () => new Response("boom", { status: 500 })) as typeof fetch;
    await assert.rejects(() => sendToLocalGitPilot(payload, "http://localhost:8000"));
  });
});

describe("gitpilot-client · cloud run (Matrix Builder backend)", () => {
  it("isCloudRunTerminal recognises terminal states only", () => {
    for (const s of ["completed", "blocked", "error", "needs_approval"]) {
      assert.equal(isCloudRunTerminal(s), true);
    }
    for (const s of ["queued", "running"]) {
      assert.equal(isCloudRunTerminal(s), false);
    }
  });

  it("createCloudRun POSTs to the bundle's MB endpoint and returns the run", async () => {
    let seenUrl = "";
    globalThis.fetch = (async (url: string) => {
      seenUrl = url;
      return new Response(JSON.stringify({ run_id: "gp-run-1", status: "queued", url: "x" }), { status: 200 });
    }) as typeof fetch;
    const r = await createCloudRun("bundle_demo", { task_id: "T1" });
    assert.match(seenUrl, /\/api\/v1\/bundles\/bundle_demo\/gitpilot\/runs$/);
    assert.equal(r.run_id, "gp-run-1");
    assert.equal(r.status, "queued");
  });

  it("getCloudRun reads status from the MB endpoint", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          run_id: "gp-run-1",
          status: "completed",
          summary: "done",
          diff_url: "/api/v1/gitpilot/runs/gp-run-1/diff",
          logs_url: "/api/v1/gitpilot/runs/gp-run-1/logs",
          test_status: "passed",
          changed_files: ["tests/test_health.py"],
        }),
        { status: 200 },
      )) as typeof fetch;
    const s = await getCloudRun("gp-run-1");
    assert.equal(s.status, "completed");
    assert.equal(s.test_status, "passed");
    assert.deepEqual(s.changed_files, ["tests/test_health.py"]);
  });

  it("cloudArtifactUrl prefixes the MB base and passes null through", () => {
    assert.equal(cloudArtifactUrl(null), null);
    // apiBaseUrl defaults to "/api/builder" in the test env (no NEXT_PUBLIC_API_BASE_URL).
    assert.match(cloudArtifactUrl("/api/v1/gitpilot/runs/x/diff") ?? "", /\/api\/v1\/gitpilot\/runs\/x\/diff$/);
  });
});

describe("gitpilot-client · validation gate + repair (Batches 7 & 8)", () => {
  const approved: CloudValidationResult = {
    run_id: "gp-run-1",
    gate: { status: "approved", can_commit: true, can_repair: false, blocked: false },
    report: { status: "approved", score: 100, violations: [], repair_prompt: null },
  };

  it("validateCloudRun POSTs to the run's validate endpoint and returns the gate", async () => {
    let seenUrl = "";
    globalThis.fetch = (async (url: string) => {
      seenUrl = url;
      return new Response(JSON.stringify(approved), { status: 200 });
    }) as typeof fetch;
    const result = await validateCloudRun("bundle_demo", "gp-run-1");
    assert.match(seenUrl, /\/api\/v1\/bundles\/bundle_demo\/gitpilot\/runs\/gp-run-1\/validate$/);
    assert.equal(result.gate.can_commit, true);
  });

  it("repairCloudRun POSTs findings and returns a new child run", async () => {
    let seenUrl = "";
    let seenBody: { repair_prompt?: string } = {};
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seenUrl = url;
      seenBody = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ run_id: "gp-run-2", status: "queued", url: "x" }), { status: 200 });
    }) as typeof fetch;
    const child = await repairCloudRun("bundle_demo", "gp-run-1", { repair_prompt: "fix it" });
    assert.match(seenUrl, /\/gitpilot\/runs\/gp-run-1\/repair$/);
    assert.equal(seenBody.repair_prompt, "fix it");
    assert.equal(child.run_id, "gp-run-2");
  });

  it("findingsFromReport flattens violations into rule: message strings", () => {
    const findings = findingsFromReport({
      status: "needs-repair",
      score: 60,
      repair_prompt: "x",
      violations: [
        { rule_id: "R1", severity: "high", message: "outside allowed_paths" },
        { rule_id: "R2", severity: "medium", message: "missing test" },
      ],
    });
    assert.deepEqual(findings, ["R1: outside allowed_paths", "R2: missing test"]);
  });
});

describe("gitpilot-client · PR flow + diff viewer (Batch 11)", () => {
  it("parseDiffLines classifies add/del/hunk/meta/context", () => {
    const lines = parseDiffLines(
      ["--- a/x", "+++ b/x", "@@ -1 +1 @@", "+added", "-removed", " context"].join("\n"),
    );
    assert.deepEqual(
      lines.map((l) => l.kind),
      ["meta", "meta", "hunk", "add", "del", "context"],
    );
  });

  it("openPr POSTs to the run's PR endpoint and returns the pr_url", async () => {
    let seenUrl = "";
    globalThis.fetch = (async (url: string) => {
      seenUrl = url;
      return new Response(
        JSON.stringify({ run_id: "gp-run-1", pr_url: "https://github.com/o/r/pull/1", status: "draft", message: "" }),
        { status: 200 },
      );
    }) as typeof fetch;
    const r = await openPr("bundle_demo", "gp-run-1", { title: "x" });
    assert.match(seenUrl, /\/api\/v1\/bundles\/bundle_demo\/gitpilot\/runs\/gp-run-1\/pr$/);
    assert.equal(r.pr_url, "https://github.com/o/r/pull/1");
  });

  it("openPr surfaces the 409 'Matrix approval required' as a clear error", async () => {
    globalThis.fetch = (async () => new Response("{}", { status: 409 })) as typeof fetch;
    await assert.rejects(() => openPr("b", "r"), /Matrix approval required/);
  });

  it("fetchDiffText fetches the proxied diff text", async () => {
    globalThis.fetch = (async () => new Response("--- a\n+++ b\n", { status: 200 })) as typeof fetch;
    const text = await fetchDiffText("/api/v1/gitpilot/runs/r/diff");
    assert.match(text, /\+\+\+ b/);
  });
});
