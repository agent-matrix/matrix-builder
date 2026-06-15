// Batch 6 — generic, public-safe template blueprints. The full JSON lives in
// public/templates/<id>.json (downloadable + editable + re-uploadable). This module holds the
// card metadata and helpers. Templates are starting points, not final architecture.

export type TemplateId =
  | "saas-platform" | "internal-tool" | "document-qna"
  | "user-portal" | "ai-agent" | "dashboard";

export type TemplateMeta = { id: TemplateId; name: string; summary: string };

// Full shape of the JSON files in public/templates (kept generic / open-source safe).
export type TemplateBlueprint = {
  schema_version: string;
  template_id: TemplateId;
  name: string;
  summary: string;
  source_type: "template";
  goals: string[];
  users: string[];
  features: string[];
  suggested_stack: string[];
  non_functional_requirements: string[];
  validation_focus: string[];
};

export const TEMPLATES: TemplateMeta[] = [
  { id: "saas-platform", name: "SaaS Platform", summary: "Multi-tenant SaaS with auth, billing, and analytics." },
  { id: "internal-tool", name: "Internal Tool", summary: "Internal admin tool with roles, reports, and integrations." },
  { id: "document-qna", name: "Document Q&A", summary: "Document assistant with uploads, retrieval, and citations." },
  { id: "user-portal", name: "User Portal", summary: "Secure portal for files, messages, and status tracking." },
  { id: "ai-agent", name: "AI Agent", summary: "Controlled agent workflow with tools, memory, and validation." },
  { id: "dashboard", name: "Dashboard", summary: "Business dashboard with charts, filters, and exports." },
];

// The two featured in the upload modal; the rest live behind "Browse all templates".
export const FEATURED_TEMPLATES: TemplateId[] = ["saas-platform", "internal-tool"];

export function templateUrl(id: TemplateId): string {
  return `/templates/${id}.json`;
}

export function templateDownloadName(id: TemplateId): string {
  return `matrix-template-${id}.json`;
}

export async function fetchTemplate(id: TemplateId): Promise<TemplateBlueprint> {
  const res = await fetch(templateUrl(id));
  if (!res.ok) throw new Error(`Template '${id}' not found`);
  return (await res.json()) as TemplateBlueprint;
}

// Fold a template into the idea string the deterministic engine parses (→ same three tiers).
export function templateToIdea(t: TemplateBlueprint): string {
  const parts = [t.name, t.summary];
  if (t.features?.length) parts.push("Key features: " + t.features.slice(0, 6).join(", "));
  if (t.goals?.length) parts.push("Goals: " + t.goals.slice(0, 4).join(", "));
  return parts.filter(Boolean).join(". ").slice(0, 3900);
}
