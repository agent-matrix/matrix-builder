"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import MatrixBuilderClient, { type InitialBuild } from "../../MatrixBuilderClient";
import { STAGES } from "@/lib/build-batches";
import { getBuild } from "@/lib/builds-store";
import { createBlueprintCandidates } from "@/lib/matrix-demo-data";

type LoadState = { status: "loading" } | { status: "missing" } | { status: "ready"; build: InitialBuild };

export default function BuildDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [state, setState] = useState<LoadState>({ status: "loading" });
  // "i" on a build card deep-links to that build's blueprint details (?view=blueprint). Read from
  // window in the effect (client-only) so we don't need a Suspense boundary for useSearchParams.
  const [initialView, setInitialView] = useState<"bundle" | "blueprint">("bundle");

  // Reconstruct the active build screen from the persisted build (deterministic from idea + tier).
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("view") === "blueprint") {
      setInitialView("blueprint");
    }
    const saved = getBuild(id);
    if (!saved) {
      setState({ status: "missing" });
      return;
    }
    const idea = saved.idea ?? saved.name.replace(/-/g, " ");
    const candidateId = saved.candidateId ?? "standard";
    const candidates = createBlueprintCandidates(idea);
    const base = candidates.find((c) => c.id === candidateId) ?? candidates[1];
    const candidate = { ...base, name: saved.name }; // keep the saved display name
    setState({
      status: "ready",
      build: {
        candidate,
        idea,
        coder: saved.coder ?? "claude-code",
        batchIndex: Math.min(saved.passed, STAGES.length - 1),
        passed: saved.passed,
        bundleId: saved.id,
      },
    });
  }, [id]);

  if (state.status === "ready") {
    return <MatrixBuilderClient key={id} initialBuild={state.build} initialView={initialView} />;
  }

  return (
    <div className="mb-dark-page">
      <header className="mb-detail-bar"><div className="l-wrap dbar-in">
        <a href="/matrix-builder" className="l-brand"><span className="gl">◇</span>Matrix Builder</a>
      </div></header>
      <div className="l-wrap tl">
        {state.status === "missing" ? (
          <div className="lib-empty reveal in">
            <div className="le-mark">◇</div>
            <div className="le-t">Build not found</div>
            <div className="le-d">It may have been deleted, or it belongs to another account.</div>
            <button className="bo-btn primary" type="button" onClick={() => router.push("/matrix-builder/builds")}>Back to My Builds</button>
          </div>
        ) : (
          <div className="lib-empty in"><div className="le-mark">◇</div><div className="le-t">Opening build…</div></div>
        )}
      </div>
    </div>
  );
}
