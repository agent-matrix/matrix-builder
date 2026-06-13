// Demo "saved builds" shown on the My Builds page (mock; a real account API would replace this).
// Mirrors agent-matrix/design (scout/matrix-data.js → SAVED_BUNDLES).

export type BuildStatus = "ready" | "validated" | "draft";

export type SavedBundle = {
  id: string;
  name: string;
  description: string;
  status: BuildStatus;
  version: string;
  files: number;
  updated: string;
  stack: string[];
};

const STD = ["PEP 8", "12-Factor", "OpenAPI", "OWASP ASVS", "CI/CD"];

export const SAVED_BUNDLES: SavedBundle[] = [
  { id: "mb_2h90dkp9h4", name: "a-github-repo-intelligence-agent", description: "Scans and summarizes GitHub repositories with context-aware insights.", status: "ready", version: "v1.0.0", files: 13, updated: "Updated 2h ago", stack: ["Python", "FastAPI", "React", "Docker"] },
  { id: "mb_docqa771a2", name: "document-qa-assistant", description: "Answers questions from your documents using RAG and citations.", status: "validated", version: "v1.1.0", files: 11, updated: "Updated 1d ago", stack: ["Python", "FastAPI", "React"] },
  { id: "mb_portf93kk1", name: "portfolio-reviewer", description: "Provides structured feedback on developer portfolios and projects.", status: "ready", version: "v1.0.0", files: 9, updated: "Updated 2d ago", stack: ["Python", "FastAPI"] },
  { id: "mb_cbexp4a8c2", name: "codebase-explainer", description: "Explains codebases and generates architecture overviews.", status: "draft", version: "v0.2.0", files: 7, updated: "Updated 3d ago", stack: ["Python", "FastAPI"] },
  { id: "mb_apispec55d", name: "api-spec-generator", description: "Generates OpenAPI specs from code and documentation.", status: "validated", version: "v1.0.2", files: 8, updated: "Updated 4d ago", stack: ["Python", "FastAPI"] },
  { id: "mb_relnotes19", name: "release-notes-bot", description: "Creates clear, concise release notes from changelogs.", status: "draft", version: "v0.1.0", files: 6, updated: "Updated 5d ago", stack: ["Python"] },
  { id: "mb_secrev7c30", name: "security-review-agent", description: "Reviews code for security issues and best practices.", status: "validated", version: "v1.2.0", files: 12, updated: "Updated 6d ago", stack: ["Python", "FastAPI", "Docker"] },
  { id: "mb_onbgd6f1aa", name: "onboarding-guide-generator", description: "Generates onboarding guides tailored to your codebase.", status: "draft", version: "v0.1.0", files: 5, updated: "Updated 1w ago", stack: ["Python", "React"] },
];

const THUMB_VARIANTS = ["sphere", "wave", "mesh", "radial", "spiral", "pyramid", "beam", "grid"];

export function thumbVariant(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return THUMB_VARIANTS[Math.abs(h) % THUMB_VARIANTS.length];
}
