// The controlled batch sequence of a Matrix build (mirrors agent-matrix/design's batches).
// Shared by the builder flow (prompt per batch) and the persisted Build Timeline.

export type BatchStatus = "passed" | "ready" | "planned" | "repair";

export type Stage = { n: string; title: string; short: string; goal: string };

export const STAGES: Stage[] = [
  { n: "01", title: "Project skeleton", short: "Skeleton", goal: "Initialize the repository, folder structure, configs, and placeholder files." },
  { n: "02", title: "Core feature", short: "Core feature", goal: "Implement the primary feature end to end, with tests." },
  { n: "03", title: "Validation & tests", short: "Validation", goal: "Add validation, error handling, and a full test suite." },
  { n: "04", title: "Publish to MatrixHub", short: "Publish", goal: "Package, sign, and publish the validated bundle to MatrixHub." },
];

export type TimelineBatch = {
  n: string;
  title: string;
  short: string;
  status: BatchStatus;
  commit?: string;
  meta: string[];
  issue?: string;
};

// The batches a build has actually completed (a clean passed progression, oldest→newest).
export function timelineBatches(passed: number): TimelineBatch[] {
  const count = Math.max(0, Math.min(passed, STAGES.length));
  return STAGES.slice(0, count).map((stage) => ({
    n: stage.n,
    title: stage.title,
    short: stage.short,
    status: "passed",
    commit: `#0${stage.n}`,
    meta: ["Prompt used", "Validation passed"],
  }));
}
