// Right-sidebar "Send to your coding agent" actions, keyed by the selected CoderId.
// One source of truth so the sidebar always matches the prompt-preview's selected coder
// (no more hardcoded Claude). Behaviour is open-and-copy or copy-only; we never claim to
// auto-send a long prompt over a URL — we copy the controlled prompt and open the tool.

import type { CoderId } from "@/types/coder";

export type CoderActionKind = "open" | "copy";
export type CoderAction = { label: string; kind: CoderActionKind; url?: string };

export type CoderActions = {
  title: string;
  description: string;
  primary: CoderAction;
  secondary?: CoderAction;
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
  gitpilot: {
    title: "Send to GitPilot",
    description:
      "Send the controlled Matrix Bundle prompt to GitPilot — it can plan, code, run tests, and review through its multi-agent workflow.",
    primary: { label: "Open GitPilot Web", kind: "open", url: "https://huggingface.co/spaces/ruslanmv/gitpilot" },
    secondary: { label: "Copy GitPilot prompt", kind: "copy" },
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
