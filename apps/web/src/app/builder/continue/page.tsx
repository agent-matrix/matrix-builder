"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  CopyButton,
  EmptyBlock,
  ErrorBlock,
  Icon,
  LoadingBlock,
  Toast,
  WorkflowBar,
  formatBatchLabel,
} from "@/components/workflow/primitives";
import { hasAuthToken } from "@/lib/auth-token";
import { createBatch, generatePromptPack, getTimeline, getVersion } from "@/lib/workflow-client";
import { CHANGE_TYPES, type ChangeType, type PromptPackResponse, type VersionResponse } from "@/lib/workflow-types";

type Phase = "loading" | "ready" | "creating" | "done" | "error";

export default function ContinueBuildPage() {
  const [versionId, setVersionId] = useState<string | null>(null);
  const [version, setVersion] = useState<VersionResponse | null>(null);
  const [nextOrdinal, setNextOrdinal] = useState(1);
  const [goal, setGoal] = useState("");
  const [changeType, setChangeType] = useState<ChangeType>("add-feature");
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string>("");
  const [pack, setPack] = useState<PromptPackResponse | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setVersionId(params.get("version"));
  }, []);

  useEffect(() => {
    if (versionId === null) return;
    if (!versionId || !hasAuthToken()) {
      setPhase("ready");
      return;
    }
    let cancelled = false;
    setPhase("loading");
    Promise.all([getVersion(versionId), getTimeline(versionId)])
      .then(([v, timeline]) => {
        if (cancelled) return;
        setVersion(v);
        setNextOrdinal(timeline.entries.filter((e) => e.kind === "batch").length + 1);
        setPhase("ready");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [versionId]);

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  async function submit() {
    if (!versionId || !goal.trim()) return;
    setPhase("creating"); // optimistic: lock the form and show the pending batch immediately
    try {
      const batch = await createBatch(versionId, goal.trim(), changeType);
      const promptPack = await generatePromptPack(batch.id, "claude-code");
      setPack(promptPack);
      setPhase("done");
      notify(`${formatBatchLabel(batch.ordinal)} created — prompt pack ready`);
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
  }

  if (versionId !== null && !versionId) {
    return (
      <>
        <WorkflowBar />
        <div className="l-wrap mb-page">
          <EmptyBlock
            title="Pick a version to continue"
            body="Continue Build adds the next batch inside an existing version. Open a build and use “Continue build”, or pass ?version=<id>."
            action={
              <Link className="bo-btn" href="/matrix-builder">
                Start a new build
              </Link>
            }
          />
        </div>
      </>
    );
  }

  if (versionId && !hasAuthToken()) {
    return (
      <>
        <WorkflowBar />
        <div className="l-wrap mb-page">
          <EmptyBlock
            title="Sign in to continue building"
            body="Continue Build writes to your private workspace, so it needs an authenticated session."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <WorkflowBar />
      <div className="l-wrap mb-page">
        <div className="mb-head reveal">
          <span className="mb-eyebrow">
            <span className="d" />
            Continue build{version ? ` · ${version.version_label}` : ""}
          </span>
          <h2 className="mb-h2">
            Add the next <em>batch</em>.
          </h2>
          <p className="mb-sub">
            One focused change inside the current version. Describe the goal, pick a change type, and Matrix
            Builder plans the batch and emits a contract-bound prompt.
          </p>
        </div>

        {phase === "loading" ? (
          <LoadingBlock message="Loading version…" />
        ) : phase === "error" ? (
          <ErrorBlock title="Couldn’t load this version" body={error} onRetry={() => setVersionId((id) => id)} />
        ) : phase === "done" && pack ? (
          <article className="darkpanel bundle reveal">
            <div className="bundle-top">
              <div>
                <span className="mb-eyebrow" style={{ color: "var(--grn-bright)" }}>
                  <span className="d" style={{ background: "var(--grn-bright)" }} />
                  Batch ready
                </span>
                <h2 className="bundle-h">Prompt pack for your AI coder</h2>
                <div className="bundle-id">
                  Batch <b>{pack.batch_id}</b> · status {pack.batch_status}
                </div>
              </div>
            </div>
            <div className="codeblock" style={{ marginTop: 18 }}>
              <div className="codeblock-bar">
                <span className="fn">coder-prompts/{pack.coder}.md</span>
                <CopyButton text={pack.prompt_text} />
              </div>
              <pre>{pack.prompt_text}</pre>
            </div>
            <div className="build-opts">
              <Link className="bo-btn primary" href={`/builder/timeline/${versionId}`}>
                <Icon name="git" size={17} />
                View build timeline
              </Link>
            </div>
          </article>
        ) : (
          <article className="darkpanel bundle reveal cb-form">
            <div className="bx-label">What should this batch do?</div>
            <textarea
              className="cb-textarea"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Add a /health endpoint with a test, wired into the existing API router."
              rows={4}
              aria-label="Batch goal"
            />
            <div className="bx-label" style={{ marginTop: 18 }}>
              Change type
            </div>
            <div className="cb-chips">
              {CHANGE_TYPES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`cb-chip${changeType === c.id ? " on" : ""}`}
                  onClick={() => setChangeType(c.id)}
                  title={c.hint}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="cb-preview">
              <Icon name="spark" size={15} />
              <span>
                Next: <b>{formatBatchLabel(nextOrdinal)}</b> · {changeType}
              </span>
            </div>
            <div className="build-opts">
              <button
                type="button"
                className="bo-btn primary"
                onClick={submit}
                disabled={phase === "creating" || !goal.trim()}
              >
                <Icon name="arrow" size={17} />
                {phase === "creating" ? `Creating ${formatBatchLabel(nextOrdinal)}…` : "Create batch"}
              </button>
            </div>
          </article>
        )}
      </div>
      <Toast message={toast} />
    </>
  );
}
