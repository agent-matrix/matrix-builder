"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AuthControls from "../AuthControls";
import BundleThumbnail from "../BundleThumbnail";
import { AUTH_EVENT } from "@/lib/auth-token";
import { BUILDS_EVENT, listBuilds, removeBuild, updatedLabel, type SavedBuild } from "@/lib/builds-store";
import { type BuildStatus } from "@/lib/saved-bundles";

const I = {
  search: (<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" /></>),
  lock: (<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>),
  check: (<><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.3l2.4 2.4 4.6-5" /></>),
  doc: (<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  shield: (<><path d="M12 2.5l7 3v5.5c0 4.3-2.9 7.4-7 9-4.1-1.6-7-4.7-7-9V5.5z" /><path d="M9 12l2 2 4-4.2" /></>),
  trash: (<><path d="M4 7h16" /><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" /><path d="M6 7l1 12a1 1 0 001 1h8a1 1 0 001-1l1-12" /><path d="M10 11v6M14 11v6" /></>),
};
function Ic({ d, size = 18 }: { d: ReactNode; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
}

const STATUS_LABEL: Record<BuildStatus, string> = { ready: "Ready", validated: "Validated", draft: "Draft" };
type Filter = "all" | "recent" | "validated" | "drafts";

export default function MyBuildsPage() {
  const router = useRouter();
  const [qy, setQy] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [builds, setBuilds] = useState<SavedBuild[]>([]);
  const [loaded, setLoaded] = useState(false); // avoid flashing the empty state before the first read
  const [pendingDelete, setPendingDelete] = useState<SavedBuild | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const name = pendingDelete.name;
    removeBuild(pendingDelete.id); // dispatches BUILDS_EVENT → list re-reads
    setPendingDelete(null);
    setToast(`Deleted “${name}”`);
    window.setTimeout(() => setToast(null), 2600);
  };

  // Builds live in localStorage, scoped to the signed-in account; re-read when they change
  // or the account switches so each user only ever sees their own private builds.
  useEffect(() => {
    const refresh = () => { setBuilds(listBuilds()); setLoaded(true); };
    refresh();
    window.addEventListener(BUILDS_EVENT, refresh);
    window.addEventListener(AUTH_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(BUILDS_EVENT, refresh);
      window.removeEventListener(AUTH_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  let list = builds.filter((b) => (b.name + " " + b.description).toLowerCase().includes(qy.toLowerCase()));
  if (filter === "validated") list = list.filter((b) => b.status === "validated");
  else if (filter === "drafts") list = list.filter((b) => b.status === "draft");
  else if (filter === "recent") list = list.slice(0, 4);

  const open = (id: string) => router.push(`/matrix-builder/builds/${id}`);

  return (
    <div className="mb-dark-page">
      <header className="mb-detail-bar"><div className="l-wrap dbar-in">
        <a href="/matrix-builder" className="l-brand"><span className="gl">◇</span>Matrix Builder</a>
        <div className="dbar-r" style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <button className="l-newbuild" type="button" onClick={() => router.push("/matrix-builder")}><Ic d={I.plus} size={15} />New build</button>
          <AuthControls />
        </div>
      </div></header>

      <div className="l-wrap lib">
        <div className="lib-head reveal in">
          <h1 className="lib-title"><span className="lib-dot" />My Builds</h1>
          <p className="lib-sub">Saved privately to your account.</p>
        </div>

        <div className="lib-controls reveal in">
          <div className="lib-search"><Ic d={I.search} /><input value={qy} onChange={(e) => setQy(e.target.value)} placeholder="Search builds…" aria-label="Search builds" /></div>
          <div className="lib-filters">
            {(["all", "recent", "validated", "drafts"] as const).map((k) => (
              <button key={k} type="button" className={"lib-pill" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>
                {k === "all" ? "All" : k === "recent" ? "Recent" : k === "validated" ? "Validated" : "Drafts"}
              </button>
            ))}
          </div>
          <div className="lib-sort">Sort by <span className="lib-sortbtn">Last updated <span className="cv">▾</span></span></div>
        </div>

        {!loaded ? (
          <div className="lib-grid stag" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="bundle-card bc-skel" aria-hidden="true" />)}
          </div>
        ) : list.length ? (
          <div className="lib-grid stag">
            {list.map((b) => (
              <article key={b.id} className="bundle-card" tabIndex={0} onClick={() => open(b.id)} onKeyDown={(e) => e.key === "Enter" && open(b.id)}>
                <div className="bc-thumb">
                  <BundleThumbnail seed={b.id} />
                  <span className="bc-lock"><Ic d={I.lock} size={14} /></span>
                  <button
                    className="bc-del"
                    type="button"
                    aria-label={`Delete ${b.name}`}
                    title="Delete build"
                    onClick={(e) => { e.stopPropagation(); setPendingDelete(b); }}
                  >
                    <Ic d={I.trash} size={15} />
                  </button>
                </div>
                <div className="bc-name">{b.name}</div>
                <div className="bc-desc">{b.description}</div>
                <div className={"bc-status " + b.status}>{b.status === "validated" ? <Ic d={I.check} size={13} /> : <span className="bc-sd" />}{STATUS_LABEL[b.status]}</div>
                <div className="bc-meta"><Ic d={I.doc} size={13} />{b.files} files <span className="bc-dotsep">·</span> {updatedLabel(b.updatedAt)}</div>
              </article>
            ))}
          </div>
        ) : builds.length ? (
          // Have builds, but the current search/filter matched none.
          <div className="lib-empty reveal in">
            <div className="le-mark">◇</div>
            <div className="le-t">No builds match your search</div>
            <div className="le-d">Try a different search or filter.</div>
            <button className="bo-btn" type="button" onClick={() => { setQy(""); setFilter("all"); }}>Clear filters</button>
          </div>
        ) : (
          // Truly empty account — first run.
          <div className="lib-empty reveal in">
            <div className="le-mark">◇</div>
            <div className="le-t">No builds yet</div>
            <div className="le-d">Start your first build, or explore the examples to see what Matrix Builder produces.</div>
            <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="bo-btn primary" type="button" onClick={() => router.push("/matrix-builder")}><Ic d={I.plus} size={16} />New build</button>
              <button className="bo-btn" type="button" onClick={() => router.push("/examples")}>Browse examples</button>
            </div>
          </div>
        )}

        <div className="lib-private reveal in"><span className="lp-ic"><Ic d={I.shield} size={20} /></span><div><b>Private by default.</b><span> Only you can see your builds.</span></div></div>
      </div>

      {pendingDelete && (
        <div className="auth-scrim" role="dialog" aria-modal="true" aria-label="Delete build" onMouseDown={(e) => { if (e.target === e.currentTarget) setPendingDelete(null); }}>
          <div className="confirm-card">
            <div className="confirm-ic"><Ic d={I.trash} size={22} /></div>
            <h3 className="confirm-h">Delete this build?</h3>
            <p className="confirm-d"><b>{pendingDelete.name}</b> will be permanently removed from this device. This can’t be undone.</p>
            <div className="confirm-actions">
              <button className="bo-btn" type="button" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="confirm-del" type="button" onClick={confirmDelete}><Ic d={I.trash} size={15} />Delete build</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="mb-toast" role="status">{toast}</div>}
    </div>
  );
}
