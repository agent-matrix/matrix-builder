// C4 — localStorage-first persistence round-trips the workspace; C3 — AI refine is opt-in.
//
// Run with: npm run test. These prove a reload restores the workspace with no server, and that
// the optional AI enhancement stays off (deterministic, no network) unless explicitly enabled.

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { generate } from "@/lib/blueprint-engine";
import { clearWorkspace, loadWorkspace, saveWorkspace, workspaceKey } from "@/lib/blueprint-persistence";
import { refineWithAI } from "@/lib/ai-refine";

function installFakeWindow(): Map<string, string> {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  return store;
}

beforeEach(() => installFakeWindow());
afterEach(() => { delete (globalThis as Record<string, unknown>).window; });

describe("C4 persistence", () => {
  it("save → load restores the workspace (reload with no server)", () => {
    const idea = "an 8-episode Phaser platformer";
    const key = workspaceKey(idea, "standard");
    const data = generate("standard", idea);
    data.chat_history = [{ id: "u1", role: "user", content: "add a boss level", timestamp: "" }];
    saveWorkspace(key, data);

    const restored = loadWorkspace(key);
    assert.ok(restored);
    assert.equal(restored!.candidate_id, "standard");
    assert.equal(restored!.batches.length, data.batches.length);
    assert.equal(restored!.chat_history[0].content, "add a boss level");
  });

  it("keys are stable per idea + candidate and isolated across them", () => {
    assert.equal(workspaceKey("idea A", "standard"), workspaceKey("idea A", "standard"));
    assert.notEqual(workspaceKey("idea A", "standard"), workspaceKey("idea B", "standard"));
    assert.notEqual(workspaceKey("idea A", "standard"), workspaceKey("idea A", "minimal"));
  });

  it("clear removes the saved workspace", () => {
    const key = workspaceKey("x", "standard");
    saveWorkspace(key, generate("standard", "x"));
    clearWorkspace(key);
    assert.equal(loadWorkspace(key), null);
  });

  it("missing / corrupt entries load as null (never throw)", () => {
    assert.equal(loadWorkspace(workspaceKey("never-saved", "standard")), null);
    const ls = (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage;
    ls.setItem(workspaceKey("bad", "standard"), "{not json");
    assert.equal(loadWorkspace(workspaceKey("bad", "standard")), null);
  });
});

describe("C3 AI refine (optional, fail-open)", () => {
  it("returns null when assist is unavailable — deterministic result stands", async () => {
    // No OllaBridge settings / no signed-in user in the test env → assist is off.
    const out = await refineWithAI(generate("standard", "a web app"), "add audit logging");
    assert.equal(out, null);
  });
});
