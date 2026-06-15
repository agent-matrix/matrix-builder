// SavedBuild ⇄ {Project, Version} mapping.
//
// The "My Builds" and active-build screens render a `SavedBuild` (the localStorage shape). The
// control plane instead stores a Project (the app, owns the slug/description) plus one or more
// Versions (each a bundle iteration with its own timeline of batches/commits). This module is the
// single seam that converts between the two, so screens stay source-agnostic: whether a build
// came from localStorage or from `GET /projects` + `GET /versions/{id}`, it reaches the UI as the
// same `SavedBuild`. When Phase 3 swaps the store for the API, only the callers change — not the
// screens, and not this mapping.

import { STAGES } from "./build-batches";
import type { SavedBuild } from "./builds-store";
import type { BuildStatus } from "./saved-bundles";
import type {
  ProjectCreate,
  ProjectResponse,
  VersionCreate,
  VersionResponse,
} from "./workflow-types";
import type { CoderId } from "@/types/coder";

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.slice(0, 72) || "matrix-project";
}

// Workflow version/commit status (draft|ready|running|committed|approved|needs-repair|…) collapses
// onto the three states the cards understand. A fully-validated timeline always wins.
export function toBuildStatus(versionStatus: string, passed = 0): BuildStatus {
  if (passed >= STAGES.length && STAGES.length > 0) return "validated";
  switch (versionStatus) {
    case "approved":
    case "committed":
    case "validated":
      return "validated";
    case "ready":
    case "running":
    case "active":
      return "ready";
    default:
      return "draft";
  }
}

export function toVersionStatus(status: BuildStatus): string {
  if (status === "validated") return "approved";
  if (status === "ready") return "ready";
  return "draft";
}

// Per-build presentation stats that live on neither Project nor Version (they're derived from the
// bundle/timeline in Phase 2/3). Callers pass what they know; sane defaults fill the rest.
export interface BuildStats {
  files?: number;
  stack?: string[];
  coder?: CoderId;
  passed?: number;
  candidateId?: SavedBuild["candidateId"];
}

export function toSavedBuild(
  project: ProjectResponse,
  version: VersionResponse,
  stats: BuildStats = {},
): SavedBuild {
  const passed = stats.passed ?? 0;
  return {
    // The version is the reopen target: timeline, batches and commits all hang off it.
    id: version.id,
    name: project.title,
    description: project.description,
    status: toBuildStatus(version.status, passed),
    version: version.version_label,
    files: stats.files ?? 0,
    stack: stats.stack ?? [],
    coder: stats.coder,
    passed,
    updatedAt: Date.parse(version.created_at) || Date.now(),
    idea: version.requirements_md || project.description,
    candidateId: stats.candidateId,
  };
}

export function toProjectCreate(build: Pick<SavedBuild, "name" | "description">): ProjectCreate {
  return {
    title: build.name,
    slug: slugify(build.name),
    description: build.description,
  };
}

export function toVersionCreate(
  build: Pick<SavedBuild, "name" | "version" | "idea" | "description">,
  projectId: string,
  parentVersionId: string | null = null,
): VersionCreate {
  return {
    project_id: projectId,
    title: build.name,
    version_label: build.version,
    requirements_md: build.idea ?? build.description,
    parent_version_id: parentVersionId,
  };
}
