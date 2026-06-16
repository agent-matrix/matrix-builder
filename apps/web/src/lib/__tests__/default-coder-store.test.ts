// Unit tests for the Default AI coder preference (default None).

import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  DEFAULT_CODER_STORAGE_KEY,
  getDefaultCoder,
  setDefaultCoder,
} from "@/lib/default-coder-store";

// Minimal window/localStorage shim so the store runs under node --test.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).window = {
  localStorage: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
};

afterEach(() => store.clear());

describe("default-coder-store", () => {
  it("defaults to None (null) when nothing is saved", () => {
    assert.equal(getDefaultCoder(), null);
  });

  it("persists and reads back a valid coder", () => {
    setDefaultCoder("gitpilot");
    assert.equal(store.get(DEFAULT_CODER_STORAGE_KEY), "gitpilot");
    assert.equal(getDefaultCoder(), "gitpilot");
  });

  it("clears the preference back to None", () => {
    setDefaultCoder("cursor");
    setDefaultCoder(null);
    assert.equal(getDefaultCoder(), null);
  });

  it("ignores an unknown/garbage stored value", () => {
    store.set(DEFAULT_CODER_STORAGE_KEY, "not-a-coder");
    assert.equal(getDefaultCoder(), null);
  });
});
