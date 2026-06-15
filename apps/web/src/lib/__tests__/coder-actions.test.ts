// Unit tests for the right-sidebar coder actions.
//
// Run with: npm run test  (node --test with type-stripping and the @/ alias resolver).
// Batch 1 focus: GitPilot is a first-class, Matrix-native coder with its own actions — no
// Claude/Codex wording leaks into its sidebar, and every action is copy/open only (zero backend).

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { CODER_ACTIONS, type CoderAction } from "@/lib/coder-actions";

const allActions = (id: keyof typeof CODER_ACTIONS): CoderAction[] => {
  const a = CODER_ACTIONS[id];
  return [a.primary, ...(a.secondary ? [a.secondary] : []), ...(a.extra ?? [])];
};

describe("CODER_ACTIONS · gitpilot (Batch 1)", () => {
  const gp = CODER_ACTIONS.gitpilot;

  it("offers the first-class GitPilot handoff buttons (cloud / local / open / copy)", () => {
    const labels = allActions("gitpilot").map((a) => a.label);
    assert.deepEqual(labels, [
      "Send to GitPilot",
      "Send to local GitPilot",
      "Open GitPilot Web",
      "Copy GitPilot prompt",
    ]);
  });

  it("primary is the cloud run; 'Open GitPilot Web' keeps its copy-and-open toast", () => {
    assert.equal(gp.primary.kind, "cloud");
    assert.equal(gp.primary.label, "Send to GitPilot");
    const openWeb = (gp.extra ?? []).find((a) => a.label === "Open GitPilot Web");
    assert.ok(openWeb);
    assert.equal(openWeb?.kind, "open");
    assert.match(openWeb?.url ?? "", /gitpilot/i);
    assert.equal(openWeb?.toast, "GitPilot prompt copied. Paste it into GitPilot to start.");
  });

  it("uses only known action kinds; 'Send to local GitPilot' is the local-bridge action", () => {
    for (const action of allActions("gitpilot")) {
      assert.ok(
        ["open", "copy", "local", "cloud"].includes(action.kind),
        `unexpected kind ${action.kind}`,
      );
    }
    // The local bridge (Batch 3) is wired to the secondary action.
    assert.equal(gp.secondary?.kind, "local");
    assert.equal(gp.secondary?.label, "Send to local GitPilot");
  });

  it("never shows Claude/Codex/Cursor/IBM Bob wording", () => {
    const blob = JSON.stringify(gp);
    for (const foreign of ["Claude", "Codex", "Cursor", "IBM Bob"]) {
      assert.ok(!blob.includes(foreign), `gitpilot actions should not mention ${foreign}`);
    }
  });

  it("keeps the GitPilot detail label", () => {
    assert.equal(gp.detailLabel, "Give GitPilot more detail");
  });
});

describe("CODER_ACTIONS · every coder", () => {
  it("has a primary action for each registered coder", () => {
    for (const id of Object.keys(CODER_ACTIONS) as (keyof typeof CODER_ACTIONS)[]) {
      assert.ok(CODER_ACTIONS[id].primary.label.length > 0, `${id} needs a primary label`);
    }
  });
});
