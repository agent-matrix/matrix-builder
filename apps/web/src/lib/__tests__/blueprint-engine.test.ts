// C1 — the in-browser blueprint engine is pure and deterministic (no network).
//
// Run with: npm run test. These cover the local orchestrator the workspace uses on every chat
// instruction, so the Details page mutates instantly and works fully offline.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { apply, generate, generateCandidates } from "@/lib/blueprint-engine";

describe("blueprint-engine.generate", () => {
  it("builds a game blueprint for a Phaser idea", () => {
    const d = generate("standard", "an 8-episode Phaser platformer on GitHub Pages");
    assert.equal(d.candidate_id, "standard");
    assert.ok(d.batches.length >= 6);
    assert.ok(d.architecture.some((n) => /phaser/i.test(n.name)));
    assert.ok(d.batches.every((b) => b.allowed_files.length && b.acceptance_criteria.length));
  });

  it("ramps minimal < standard < production", () => {
    const idea = "A SaaS dashboard with auth";
    const n = (id: string) => generate(id, idea).batches.length;
    assert.ok(n("minimal") < n("standard"));
    assert.ok(n("standard") < n("production"));
  });

  it("generateCandidates returns the three tiers", () => {
    const cs = generateCandidates("a platformer game");
    assert.deepEqual(cs.map((c) => c.id), ["minimal", "standard", "production"]);
    assert.ok(cs.some((c) => c.recommended));
  });
});

describe("blueprint-engine.apply (local orchestrator)", () => {
  const base = () => generate("standard", "an 8-episode Phaser platformer");

  it("adds a boss batch", () => {
    const before = base();
    const res = apply(before, "add a boss level");
    assert.equal(res.data.batches.length, before.batches.length + 1);
    assert.match(res.data.batches.at(-1)!.name, /boss/i);
    assert.ok(res.updatedSections.includes("batches"));
    // purity: the input is untouched
    assert.equal(before.batches.length, base().batches.length);
  });

  it("reduces scope", () => {
    const before = base();
    const res = apply(before, "make this smaller");
    assert.equal(res.data.batches.length, before.batches.length - 1);
  });

  it("splits a batch into two", () => {
    const before = base();
    const res = apply(before, "split batch 3 into two");
    assert.equal(res.data.batches.length, before.batches.length + 1);
    assert.ok(res.data.batches.some((b) => /part 1/.test(b.name)));
    assert.ok(res.data.batches.some((b) => /part 2/.test(b.name)));
    // batches stay renumbered batch-01..NN
    res.data.batches.forEach((b, i) => assert.equal(b.id, `batch-${String(i + 1).padStart(2, "0")}`));
  });

  it("switches the stack (architecture + file plan)", () => {
    const res = apply(generate("standard", "a web app"), "use FastAPI instead of Express");
    assert.ok(res.updatedSections.includes("architecture"));
    assert.ok(res.updatedSections.includes("filePlan"));
    assert.ok(res.data.architecture.some((n) => /fastapi/i.test(n.description)));
  });

  it("adds an architecture component (worker/queue)", () => {
    const res = apply(generate("minimal", "a web app"), "add a worker queue");
    assert.ok(res.data.architecture.some((n) => /worker/i.test(n.name)));
    assert.ok(res.updatedSections.includes("architecture"));
  });
});
