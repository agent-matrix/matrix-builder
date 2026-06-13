"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

// --- icons (subset of the Matrix Builder design language) ----------------------------------

const PATHS: Record<string, ReactNode> = {
  back: <path d="M14 6l-6 6 6 6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.2" />
      <path d="M5.5 15.5H5a1.5 1.5 0 01-1.5-1.5V5A1.5 1.5 0 015 3.5h9A1.5 1.5 0 0115.5 5v.5" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.3l2.4 2.4 4.6-5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  git: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="9" r="2.5" />
      <path d="M6 8.5v7M16 10.5c-3 1.5-7 .5-9 4" />
    </>
  ),
  spark: <path d="M13 2.5L4.5 14H10l-1 7.5L17.5 10H12l1-7.5z" />,
  wrench: <path d="M14.7 6.3a4 4 0 00-5.4 5l-6 6 2.4 2.4 6-6a4 4 0 005-5.4l-2.6 2.6-2-2 2.6-2.6z" />,
};

export function Icon({ name, size = 18, sw = 1.7 }: { name: string; size?: number; sw?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

// --- status mapping (engine status -> UI copy + tone) --------------------------------------

export type Tone = "passed" | "repair" | "rejected" | "running" | "neutral";

export function statusUi(status: string): { label: string; tone: Tone } {
  switch (status) {
    case "approved":
    case "committed":
      return { label: "Passed", tone: "passed" };
    case "needs-repair":
      return { label: "Needs repair", tone: "repair" };
    case "rejected":
    case "failed":
      return { label: "Rejected", tone: "rejected" };
    case "running":
      return { label: "Running", tone: "running" };
    case "ready":
      return { label: "Ready", tone: "neutral" };
    case "draft":
      return { label: "Draft", tone: "neutral" };
    default:
      return { label: status.replace(/-/g, " "), tone: "neutral" };
  }
}

export function StatusMarker({ status }: { status: string }) {
  const { label, tone } = statusUi(status);
  return (
    <span className={`wf-status wf-${tone}`}>
      <span className="wf-dot" />
      {label}
    </span>
  );
}

export function formatBatchLabel(ordinal: number): string {
  return `Batch ${String(ordinal).padStart(2, "0")}`;
}

// --- top bar ------------------------------------------------------------------------------

export function WorkflowBar({ backHref = "/matrix-builder" }: { backHref?: string }) {
  return (
    <header className="mb-bar">
      <div className="l-wrap mb-bar-in">
        <div className="l-brand">
          <span className="gl">◇</span>Matrix Builder
        </div>
        <Link className="mb-back" href={backHref}>
          <Icon name="back" size={16} />
          Back
        </Link>
      </div>
    </header>
  );
}

// --- copy button --------------------------------------------------------------------------

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={`copybtn${done ? " done" : ""}`}
      onClick={() => {
        try {
          void navigator.clipboard?.writeText(text);
        } catch {
          // clipboard unavailable; ignore
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      <Icon name={done ? "check" : "copy"} size={15} />
      {done ? "Copied" : label}
    </button>
  );
}

// --- loading / empty / error state blocks --------------------------------------------------

export function LoadingBlock({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="wf-state" role="status" aria-live="polite">
      <span className="wf-spinner" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}

export function EmptyBlock({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="wf-state">
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  );
}

export function ErrorBlock({ title, body, onRetry }: { title: string; body?: string; onRetry?: () => void }) {
  return (
    <div className="wf-state wf-state-error">
      <span className="wf-state-ic" aria-hidden="true">
        <Icon name="alert" size={26} />
      </span>
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {onRetry ? (
        <button type="button" className="bo-btn" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-toast">
      <Icon name="check" size={17} />
      {message}
    </div>
  );
}
