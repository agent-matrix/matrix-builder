"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AuthControls from "../AuthControls";
import BundleThumbnail from "../BundleThumbnail";
import { SAVED_BUNDLES, thumbVariant, type BuildStatus } from "@/lib/saved-bundles";

const I = {
  search: (<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" /></>),
  lock: (<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></>),
  check: (<><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.3l2.4 2.4 4.6-5" /></>),
  doc: (<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  shield: (<><path d="M12 2.5l7 3v5.5c0 4.3-2.9 7.4-7 9-4.1-1.6-7-4.7-7-9V5.5z" /><path d="M9 12l2 2 4-4.2" /></>),
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

  let list = SAVED_BUNDLES.filter((b) => (b.name + " " + b.description).toLowerCase().includes(qy.toLowerCase()));
  if (filter === "validated") list = list.filter((b) => b.status === "validated");
  else if (filter === "drafts") list = list.filter((b) => b.status === "draft");
  else if (filter === "recent") list = list.slice(0, 4);

  const open = () => router.push("/matrix-builder");

  return (
    <div className="mb-dark-page">
      <header className="mb-detail-bar"><div className="l-wrap dbar-in">
        <div className="l-brand"><span className="gl">◇</span>Matrix Builder</div>
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

        {list.length ? (
          <div className="lib-grid stag">
            {list.map((b) => (
              <article key={b.id} className="bundle-card" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === "Enter" && open()}>
                <div className="bc-thumb"><BundleThumbnail variant={thumbVariant(b.id)} /><span className="bc-lock"><Ic d={I.lock} size={14} /></span></div>
                <div className="bc-name">{b.name}</div>
                <div className="bc-desc">{b.description}</div>
                <div className={"bc-status " + b.status}>{b.status === "validated" ? <Ic d={I.check} size={13} /> : <span className="bc-sd" />}{STATUS_LABEL[b.status]}</div>
                <div className="bc-meta"><Ic d={I.doc} size={13} />{b.files} files <span className="bc-dotsep">·</span> {b.updated}</div>
              </article>
            ))}
          </div>
        ) : (
          <div className="lib-empty reveal in">
            <div className="le-mark">◇</div>
            <div className="le-t">No builds found</div>
            <div className="le-d">Try a different search, or start a new build.</div>
            <button className="bo-btn primary" type="button" onClick={() => router.push("/matrix-builder")}><Ic d={I.plus} size={16} />New build</button>
          </div>
        )}

        <div className="lib-private reveal in"><span className="lp-ic"><Ic d={I.shield} size={20} /></span><div><b>Private by default.</b><span> Only you can see your builds.</span></div></div>
      </div>
    </div>
  );
}
