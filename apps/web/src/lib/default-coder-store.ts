// Default AI coder preference (browser-local).
//
// "Which coder should new builds preselect?" Default is None — no override, so
// the app falls back to its built-in default. Setting it (e.g. GitPilot) makes
// every new build start on that coder. Purely a UI convenience; it never touches
// the deterministic Matrix contract.

import type { CoderId } from "@/types/coder";

export const DEFAULT_CODER_STORAGE_KEY = "matrix-builder:default-coder";

const VALID: CoderId[] = [
  "claude-code",
  "codex-chatgpt",
  "cursor",
  "gitpilot",
  "ibm-bob",
  "generic-ai-coder",
];

// The saved default, or null for "None" (no preference). SSR-safe.
export function getDefaultCoder(): CoderId | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DEFAULT_CODER_STORAGE_KEY);
  return raw && (VALID as string[]).includes(raw) ? (raw as CoderId) : null;
}

// Persist a default coder, or clear it (null = None).
export function setDefaultCoder(coder: CoderId | null): void {
  if (typeof window === "undefined") return;
  if (coder) window.localStorage.setItem(DEFAULT_CODER_STORAGE_KEY, coder);
  else window.localStorage.removeItem(DEFAULT_CODER_STORAGE_KEY);
}
