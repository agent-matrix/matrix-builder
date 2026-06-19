// C4 — localStorage-first persistence for the Blueprint workspace.
//
// The workspace autosaves its single state object (which already embeds the chat history) to
// localStorage on every edit, keyed per idea + candidate. On mount the store rehydrates from it,
// so a reload restores the workspace with no server. All access is guarded + best-effort: a
// quota error or private-mode block degrades silently to in-memory only.

import type { BlueprintDetailsData } from "@/types/blueprint-state";

const PREFIX = "matrix-builder:blueprint:v1";

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function workspaceKey(idea: string, candidateId: string): string {
  return `${PREFIX}:${hash(idea.trim())}:${candidateId}`;
}

export function saveWorkspace(key: string, data: BlueprintDetailsData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota / private mode — keep working in memory */
  }
}

export function loadWorkspace(key: string): BlueprintDetailsData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw) as BlueprintDetailsData;
    return data && Array.isArray(data.batches) ? data : null;
  } catch {
    return null;
  }
}

export function clearWorkspace(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
