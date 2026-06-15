// Per-user persistence for "My Builds", in localStorage.
//
// Each account gets its own private bucket keyed by email (`mb:builds:v1:user:<email>`),
// guests fall back to `mb:builds:v1:guest`. Builds are never shared between users — switching
// accounts shows a different bucket. A real account API would back this later; the shape is
// designed so the swap is local to this module.

import { getUser } from "@/lib/auth-token";
import { type BuildStatus } from "@/lib/saved-bundles";
import type { CoderId } from "@/types/coder";

export type SavedBuild = {
  id: string;
  name: string;
  description: string;
  status: BuildStatus;
  version: string;
  files: number;
  updatedAt: number; // epoch ms — labels are derived, sorting is stable
  stack: string[];
  coder?: CoderId;
  passed: number; // count of batches that passed validation (0..STAGES.length)
  // Enough to deterministically reconstruct the build (blueprint + bundle files) when reopened.
  idea?: string;
  candidateId?: "minimal" | "standard" | "production";
};

const PREFIX = "mb:builds:v1:";
export const BUILDS_EVENT = "mb-builds-changed";

// The old seeded demo builds (former SAVED_BUNDLES) were written into browsers' localStorage by
// earlier versions. Phase 5 stopped seeding, but existing browsers still carry them — purge these
// exact ids on read so My Builds shows only the user's real builds. Real builds never use these ids.
const LEGACY_DEMO_IDS = new Set([
  "mb_2h90dkp9h4", "mb_docqa771a2", "mb_portf93kk1", "mb_cbexp4a8c2",
  "mb_apispec55d", "mb_relnotes19", "mb_secrev7c30", "mb_onbgd6f1aa",
]);

function userKey(): string {
  const email = getUser()?.email?.trim().toLowerCase();
  return email ? `user:${email}` : "guest";
}

function storageKey(): string {
  return PREFIX + userKey();
}

function read(): SavedBuild[] | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey());
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const list = parsed as SavedBuild[];
    const cleaned = list.filter((b) => !LEGACY_DEMO_IDS.has(b.id));
    if (cleaned.length !== list.length) {
      // Drop the legacy demos from storage for good (one-time, on first read after upgrade).
      window.localStorage.setItem(storageKey(), JSON.stringify(cleaned));
    }
    return cleaned;
  } catch {
    return null;
  }
}

function persist(list: SavedBuild[], notify: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(), JSON.stringify(list));
  if (notify) window.dispatchEvent(new Event(BUILDS_EVENT));
}

export function listBuilds(): SavedBuild[] {
  // Fresh accounts start empty (no seeded demos); the My Builds page shows its empty state.
  const list = read() ?? [];
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getBuild(id: string): SavedBuild | null {
  return listBuilds().find((build) => build.id === id) ?? null;
}

export function upsertBuild(build: SavedBuild): void {
  const list = read() ?? [];
  const index = list.findIndex((entry) => entry.id === build.id);
  if (index >= 0) list[index] = build;
  else list.unshift(build);
  persist(list, true);
}

export function removeBuild(id: string): void {
  const list = (read() ?? []).filter((build) => build.id !== id);
  persist(list, true);
}

// Convenience used by the builder flow to record progress for the current build.
export function saveBuildProgress(opts: {
  id: string;
  name: string;
  description: string;
  files: number;
  stack: string[];
  coder: CoderId;
  passed: number;
  status: BuildStatus;
  idea: string;
  candidateId: "minimal" | "standard" | "production";
}): void {
  upsertBuild({ ...opts, version: "v1.0.0", updatedAt: Date.now() });
}

export function updatedLabel(updatedAt: number): string {
  const diff = Math.max(0, Date.now() - updatedAt);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "Updated just now";
  if (diff < hour) return `Updated ${Math.round(diff / minute)}m ago`;
  if (diff < day) return `Updated ${Math.round(diff / hour)}h ago`;
  const days = Math.round(diff / day);
  if (days >= 7) return `Updated ${Math.round(days / 7)}w ago`;
  return `Updated ${days}d ago`;
}
