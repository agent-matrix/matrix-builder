"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import {
  EmptyBlock,
  ErrorBlock,
  Icon,
  LoadingBlock,
  StatusMarker,
  WorkflowBar,
  formatBatchLabel,
  statusUi,
} from "@/components/workflow/primitives";
import { hasAuthToken } from "@/lib/auth-token";
import { fetchThumbnail, getTimeline, getVersion } from "@/lib/workflow-client";
import type { TimelineEntry, TimelineResponse, VersionResponse } from "@/lib/workflow-types";

type Phase = "loading" | "ready" | "error";

const ENTRY_ICON: Record<TimelineEntry["kind"], string> = {
  batch: "spark",
  commit: "git",
  run: "check",
};

function entryTitle(entry: TimelineEntry): string {
  if (entry.kind === "batch") return `${formatBatchLabel(entry.ordinal ?? 1)} · ${entry.title || "Batch"}`;
  if (entry.kind === "commit") return `Commit #${entry.commit_no ?? 0}${entry.title ? ` · ${entry.title}` : ""}`;
  return entry.title || "Validation run";
}

export default function BuildTimelinePage() {
  const params = useParams<{ versionId: string }>();
  const versionId = params.versionId;

  const [version, setVersion] = useState<VersionResponse | null>(null);
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null);
  const [thumb, setThumb] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!versionId || !hasAuthToken()) return;
    setPhase("loading");
    Promise.all([getVersion(versionId), getTimeline(versionId)])
      .then(([v, t]) => {
        setVersion(v);
        setTimeline(t);
        setPhase("ready");
        fetchThumbnail(versionId)
          .then(setThumb)
          .catch(() => setThumb(""));
      })
      .catch((err: Error) => {
        setError(err.message);
        setPhase("error");
      });
  }, [versionId]);

  useEffect(() => {
    if (!versionId) return;
    if (!hasAuthToken()) {
      setPhase("ready");
      return;
    }
    load();
  }, [versionId, load]);

  if (!hasAuthToken()) {
    return (
      <>
        <WorkflowBar />
        <div className="l-wrap mb-page">
          <EmptyBlock title="Sign in to view your build timeline" body="The timeline reads your private workspace." />
        </div>
      </>
    );
  }

  const entries = timeline?.entries ?? [];

  return (
    <>
      <WorkflowBar />
      <div className="l-wrap mb-page">
        <div className="mb-head reveal">
          <span className="mb-eyebrow">
            <span className="d" />
            Build timeline{timeline ? ` · ${timeline.version_label}` : ""}
          </span>
          <h2 className="mb-h2">
            Every batch, <em>in order</em>.
          </h2>
          <p className="mb-sub">A read-only history of this version: each batch, its commit, and its validation outcome.</p>
        </div>

        {phase === "loading" ? (
          <LoadingBlock message="Loading timeline…" />
        ) : phase === "error" ? (
          <ErrorBlock title="Couldn’t load the timeline" body={error} onRetry={load} />
        ) : (
          <div className="tl-grid reveal">
            <aside className="tl-version">
              <div
                className="tl-thumb"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: thumb }}
              />
              <div className="tl-version-label">{timeline?.version_label}</div>
              <div className="tl-version-title">{version?.title}</div>
              {version ? <StatusMarker status={version.status} /> : null}
              <Link className="bo-btn" href={`/builder/continue?version=${versionId}`}>
                <Icon name="spark" size={16} />
                Continue build
              </Link>
            </aside>

            <div className="tl-list">
              {entries.length === 0 ? (
                <EmptyBlock
                  title="No batches yet"
                  body="Continue this build to add the first batch."
                  action={
                    <Link className="bo-btn primary" href={`/builder/continue?version=${versionId}`}>
                      Continue build
                    </Link>
                  }
                />
              ) : (
                entries.map((entry) => {
                  const { tone } = statusUi(entry.status);
                  const needsRepair = entry.kind === "run" && (tone === "repair" || tone === "rejected");
                  return (
                    <article key={`${entry.kind}-${entry.id}`} className={`tl-card tl-${entry.kind}`}>
                      <span className={`tl-ic wf-${tone}`}>
                        <Icon name={ENTRY_ICON[entry.kind]} size={18} />
                      </span>
                      <div className="tl-body">
                        <div className="tl-title">{entryTitle(entry)}</div>
                        <div className="tl-meta">
                          <StatusMarker status={entry.status} />
                          {entry.kind === "run" ? (
                            <Link className="tl-review" href={`/builder/validation/${entry.id}`}>
                              {needsRepair ? "Review repair" : "View result"}
                              <Icon name="arrow" size={14} />
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
