"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CopyButton,
  EmptyBlock,
  ErrorBlock,
  Icon,
  LoadingBlock,
  StatusMarker,
  Toast,
  WorkflowBar,
  statusUi,
} from "@/components/workflow/primitives";
import { hasAuthToken } from "@/lib/auth-token";
import { createRepairBatch, getRunEvents, getValidationRun } from "@/lib/workflow-client";
import type { PromptPackResponse, RunEvent, ValidationRunResponse } from "@/lib/workflow-types";

type Phase = "loading" | "ready" | "error";
const TERMINAL = new Set(["run.completed", "run.failed"]);

export default function ValidationResultPage() {
  const params = useParams<{ runId: string }>();
  const runId = params.runId;

  const [run, setRun] = useState<ValidationRunResponse | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [repair, setRepair] = useState<PromptPackResponse | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const liveRef = useRef(false);

  const refresh = useCallback(() => {
    if (!runId || !hasAuthToken()) return;
    setPhase("loading");
    getValidationRun(runId)
      .then((r) => {
        setRun(r);
        setPhase("ready");
      })
      .catch((err: Error) => {
        setError(err.message);
        setPhase("error");
      });
  }, [runId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Live append: while the run is not terminal, poll the append-only event log and refresh
  // the persisted result when a terminal event arrives.
  useEffect(() => {
    if (!run || !hasAuthToken()) return;
    if (run.status !== "running") return;
    if (liveRef.current) return;
    liveRef.current = true;
    let after = 0;
    let stop = false;
    const tick = async () => {
      while (!stop) {
        try {
          const batch = await getRunEvents(runId, after);
          if (batch.length) {
            after = batch[batch.length - 1].seq;
            setEvents((prev) => [...prev, ...batch]);
            if (batch.some((e) => TERMINAL.has(e.event_type))) {
              const fresh = await getValidationRun(runId);
              setRun(fresh);
              break;
            }
          }
        } catch {
          break;
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
      liveRef.current = false;
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [run, runId]);

  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  }

  async function confirmRepair() {
    setConfirming(false);
    try {
      const pack = await createRepairBatch(runId, "claude-code");
      setRepair(pack);
      notify("Repair batch created — prompt ready");
    } catch (err) {
      notify((err as Error).message);
    }
  }

  if (!hasAuthToken()) {
    return (
      <>
        <WorkflowBar />
        <div className="l-wrap mb-page">
          <EmptyBlock title="Sign in to view validation" body="Validation results live in your private workspace." />
        </div>
      </>
    );
  }

  const tone = run ? statusUi(run.status).tone : "neutral";
  const canRepair = tone === "repair" || tone === "rejected";

  return (
    <>
      <WorkflowBar />
      <div className="l-wrap mb-page">
        <div className="mb-head reveal">
          <span className="mb-eyebrow">
            <span className="d" />
            Validation result
          </span>
          <h2 className="mb-h2">
            Checked against the <em>contract</em>.
          </h2>
        </div>

        {phase === "loading" && !run ? (
          <LoadingBlock message="Loading validation…" />
        ) : phase === "error" ? (
          <ErrorBlock title="Couldn’t load this run" body={error} onRetry={refresh} />
        ) : run ? (
          <>
            <article className={`darkpanel bundle validation-panel reveal vr-${tone}`}>
              <div className="bundle-top">
                <div>
                  <span className="mb-eyebrow" style={{ color: "var(--grn-bright)" }}>
                    <span className="d" style={{ background: "var(--grn-bright)" }} />
                    Run {run.id}
                  </span>
                  <h2 className="bundle-h">{statusUi(run.status).label}</h2>
                </div>
                <StatusMarker status={run.status} />
              </div>
              <div className="score-row">
                <strong>{run.score ?? "—"}</strong>
                <span className="bundle-id">/ 100 · {run.runner}</span>
              </div>

              {run.status === "running" ? (
                <div className="vr-live">
                  <span className="wf-spinner" aria-hidden="true" />
                  <span>Validating… streaming live</span>
                </div>
              ) : null}

              {run.findings.length === 0 && run.status !== "running" ? (
                <div className="success-note">
                  <Icon name="check" size={16} />
                  No findings — the change stayed within the contract.
                </div>
              ) : (
                <div className="violation-list">
                  {run.findings.map((f) => (
                    <div key={f.id} className={`violation-card wf-${f.severity === "error" ? "rejected" : f.severity === "warning" ? "repair" : "passed"}`}>
                      <div className="vr-finding-head">
                        <strong>{f.check_name}</strong>
                        <span className="mb-tag n">{f.severity}</span>
                      </div>
                      <p>{f.message}</p>
                      {f.file_path ? <code>{f.file_path}</code> : null}
                      {f.remediation ? <p className="vr-remedy">{f.remediation}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </article>

            {canRepair ? (
              <article className="darkpanel bundle repair-panel reveal">
                <div className="bx-label">Repair</div>
                {repair ? (
                  <>
                    <div className="codeblock">
                      <div className="codeblock-bar">
                        <span className="fn">repair · {repair.coder}</span>
                        <CopyButton text={repair.prompt_text} label="Copy repair prompt" />
                      </div>
                      <pre>{repair.prompt_text}</pre>
                    </div>
                    <div className="vr-repair-note">
                      <Icon name="check" size={15} />
                      Repair batch <b>{repair.batch_id}</b> is ready. Paste the prompt into your AI coder, then
                      submit the changes to validate again.
                    </div>
                  </>
                ) : confirming ? (
                  <div className="vr-confirm">
                    <p>Create a fix-issue batch scoped to these findings? It ships ready with a prompt.</p>
                    <div className="vr-confirm-actions">
                      <button type="button" className="bo-btn primary" onClick={confirmRepair}>
                        <Icon name="check" size={16} />
                        Yes, create repair batch
                      </button>
                      <button type="button" className="bo-btn" onClick={() => setConfirming(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="build-opts" style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}>
                    <button type="button" className="bo-btn primary" onClick={() => setConfirming(true)}>
                      <Icon name="spark" size={16} />
                      Create repair batch
                    </button>
                  </div>
                )}
              </article>
            ) : null}

            {events.length ? (
              <article className="darkpanel bundle reveal">
                <div className="bx-label">Live events</div>
                <div className="vr-events">
                  {events.map((e) => (
                    <div key={e.seq} className="vr-event">
                      <span className="vr-event-seq">{String(e.seq).padStart(2, "0")}</span>
                      <span className="vr-event-type">{e.event_type}</span>
                    </div>
                  ))}
                </div>
              </article>
            ) : null}
          </>
        ) : (
          <EmptyBlock title="Run not found" body="This validation run doesn’t exist or isn’t yours." />
        )}
      </div>
      <Toast message={toast} />
    </>
  );
}
