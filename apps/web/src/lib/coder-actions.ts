// Right-sidebar "Send to your coding agent" actions, keyed by the selected CoderId.
// One source of truth so the sidebar always matches the prompt-preview's selected coder
// (no more hardcoded Claude). Behaviour is open-and-copy or copy-only; we never claim to
// auto-send a long prompt over a URL — we copy the controlled prompt and open the tool.

import type { CoderId } from "@/types/coder";

// "cloud" creates a run via the Matrix Builder backend (server signs + holds the
// secret); "local" probes a service the user runs on their machine and POSTs to
// it (GitPilot only); "open"/"copy" stay clipboard-safe.
export type CoderActionKind = "open" | "copy" | "local" | "cloud";
// `toast` overrides the default "Prompt copied…" message for coders that want their own wording.
export type CoderAction = { label: string; kind: CoderActionKind; url?: string; toast?: string };

export type CoderActions = {
  title: string;
  description: string;
  primary: CoderAction;
  secondary?: CoderAction;
  // Optional extra buttons rendered after `secondary`, before the shared "Download ZIP" action.
  // Lets a first-class coder (e.g. GitPilot) offer more than two handoff paths.
  extra?: CoderAction[];
  detailLabel: string;
};

// Agents that can fetch a URL get the "directly" wording; others get the ZIP-fallback note.
const CAN_FETCH = "The prompt carries a real, signed bundle URL your agent can fetch directly.";
const ZIP_FALLBACK =
  "The prompt includes the signed bundle URL. If your agent can't fetch it, download the ZIP instead.";

export const CODER_ACTIONS: Record<CoderId, CoderActions> = {
  "claude-code": {
    title: "Send to Claude",
    description: CAN_FETCH,
    primary: { label: "Send to Claude Code Web", kind: "open", url: "https://claude.ai/code" },
    secondary: { label: "Send to local Claude Code", kind: "copy" },
    detailLabel: "Give Claude more detail",
  },
  "codex-chatgpt": {
    title: "Send to Codex",
    description: ZIP_FALLBACK,
    primary: { label: "Open Codex", kind: "open", url: "https://chatgpt.com/codex/" },
    secondary: { label: "Copy Codex prompt", kind: "copy" },
    detailLabel: "Give Codex more detail",
  },
  cursor: {
    title: "Send to Cursor",
    description: ZIP_FALLBACK,
    primary: { label: "Open Cursor", kind: "open", url: "https://cursor.com/" },
    secondary: { label: "Copy Cursor prompt", kind: "copy" },
    detailLabel: "Give Cursor more detail",
  },
  // GitPilot is the Matrix-native AI coder, so it gets its own first-class actions (no Claude/Codex
  // wording). Batch 1 is UI-only: every action copies the controlled prompt and opens/guides — no
  // service call yet. The local bridge (health probe + POST) and the cloud run API land in Batch 3+.
  gitpilot: {
    title: "Send to GitPilot",
    description:
      "GitPilot can read the signed Matrix Bundle, plan the work, implement the task, run tests, and return a controlled diff.",
    primary: {
      label: "Send to GitPilot",
      kind: "cloud",
    },
    secondary: {
      label: "Send to local GitPilot",
      kind: "local",
    },
    extra: [
      {
        label: "Open GitPilot Web",
        kind: "open",
        url: "https://huggingface.co/spaces/ruslanmv/gitpilot",
        toast: "GitPilot prompt copied. Paste it into GitPilot to start.",
      },
      {
        label: "Copy GitPilot prompt",
        kind: "copy",
        toast: "GitPilot prompt copied to clipboard.",
      },
    ],
    detailLabel: "Give GitPilot more detail",
  },
  "ibm-bob": {
    title: "Send to IBM Bob",
    description: ZIP_FALLBACK,
    primary: { label: "Open IBM Bob", kind: "open", url: "https://bob.ibm.com/" },
    secondary: { label: "Copy IBM Bob prompt", kind: "copy" },
    detailLabel: "Give IBM Bob more detail",
  },
  "generic-ai-coder": {
    title: "Send to coding agent",
    description: "Use this controlled prompt with any AI coding agent.",
    primary: { label: "Copy prompt", kind: "copy" },
    detailLabel: "Give the agent more detail",
  },
};
