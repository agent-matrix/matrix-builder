// C5 — Capability probe: is a control plane actually reachable?
//
// The Blueprint workspace is fully client-side (C0–C4). The server is an OPTIONAL sync target:
// callers gate every `/api/v1/blueprints/*` request behind `getCapabilities()`, so when no backend
// is present (static hosting, offline) the app makes zero per-interaction requests and the UX is
// identical. The probe runs at most once (cached), is timeout-bounded, and never throws.

import { apiBaseUrl } from "@/lib/api-client";

export interface Capabilities {
  /** A control plane responded to /health — server sync/enhancement is available. */
  server: boolean;
}

let cache: Capabilities | null = null;
let inflight: Promise<Capabilities> | null = null;

export async function getCapabilities(opts: { timeoutMs?: number } = {}): Promise<Capabilities> {
  if (cache) return cache;
  if (inflight) return inflight;
  if (typeof window === "undefined" || typeof fetch === "undefined") return { server: false };

  inflight = (async () => {
    let server = false;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 1500);
      const res = await fetch(`${apiBaseUrl}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      server = res.ok;
    } catch {
      server = false; // unreachable / blocked / refused — stay fully local
    }
    cache = { server };
    inflight = null;
    return cache;
  })();
  return inflight;
}

/** Test/runtime hook to forget the cached probe. */
export function resetCapabilities(): void {
  cache = null;
  inflight = null;
}
