// C6 — Proof: the Blueprint workspace is fully offline.
//
// With the network blocked, generate → edit → persist → reload all succeed and the data path
// makes ZERO requests. The capability probe degrades to {server:false} without throwing, so no
// per-interaction request is ever attempted. This is the unit-level equivalent of an
// airplane-mode browser e2e (the app has no Playwright harness).

import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { apply, generate } from "@/lib/blueprint-engine";
import { loadWorkspace, saveWorkspace, workspaceKey } from "@/lib/blueprint-persistence";
import { getCapabilities, resetCapabilities } from "@/lib/capabilities";

let fetchCalls = 0;
const realFetch = globalThis.fetch;

function installOfflineWindow(): void {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  // Network is blocked: every request rejects (like airplane mode / refused connection).
  (globalThis as Record<string, unknown>).fetch = (..._args: unknown[]) => {
    fetchCalls++;
    return Promise.reject(new Error("ERR_NETWORK_BLOCKED"));
  };
}

beforeEach(() => { fetchCalls = 0; resetCapabilities(); installOfflineWindow(); });
afterEach(() => {
  delete (globalThis as Record<string, unknown>).window;
  (globalThis as Record<string, unknown>).fetch = realFetch;
});

describe("C6 — fully offline workspace", () => {
  it("generate → edit → persist → reload, with ZERO network on the data path", () => {
    const idea = "an 8-episode Phaser platformer on GitHub Pages";
    const key = workspaceKey(idea, "standard");

    // generate (local)
    let data = generate("standard", idea);
    const before = data.batches.length;

    // edit (local engine) — add a boss
    const res = apply(data, "add a boss level");
    data = res.data;
    assert.equal(data.batches.length, before + 1);
    assert.match(data.batches.at(-1)!.name, /boss/i);

    // persist (localStorage) + reload (new read)
    saveWorkspace(key, data);
    const reloaded = loadWorkspace(key);
    assert.ok(reloaded);
    assert.equal(reloaded!.batches.length, before + 1);
    assert.match(reloaded!.batches.at(-1)!.name, /boss/i);

    // the entire data path touched the network zero times
    assert.equal(fetchCalls, 0);
  });

  it("capability probe degrades to {server:false} without throwing", async () => {
    const cap = await getCapabilities({ timeoutMs: 50 });
    assert.equal(cap.server, false);
    assert.equal(fetchCalls, 1); // exactly one probe, caught — not per interaction
    // cached: a second call does not probe again
    const again = await getCapabilities({ timeoutMs: 50 });
    assert.equal(again.server, false);
    assert.equal(fetchCalls, 1);
  });

  it("a second session restores the same workspace from localStorage", () => {
    const idea = "a SaaS dashboard with auth";
    const key = workspaceKey(idea, "production");
    const data = apply(generate("production", idea), "add audit logging").data;
    saveWorkspace(key, data);

    // "reload": a fresh read of the same key returns the identical plan
    const restored = loadWorkspace(key);
    assert.deepEqual(restored!.batches.map((b) => b.name), data.batches.map((b) => b.name));
    assert.equal(fetchCalls, 0);
  });
});
