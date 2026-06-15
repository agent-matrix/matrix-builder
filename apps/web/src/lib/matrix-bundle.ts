// OFFLINE FALLBACK ONLY. The build flow downloads the engine's real bundle zip (/bundles/{id}
// /download) and shows the engine's file manifest; this reconstructs an equivalent bundle locally
// only when the API is unreachable, so the demo still produces a downloadable zip without a backend.
import type { BlueprintCandidate } from "@/types/blueprint";
import type { BundleFile } from "@/types/bundle";
import { AI_CODERS } from "./constants";
import { createCoderPrompt, bundleUrl } from "./coder-prompts";

export function createBundleFiles(
  idea: string,
  candidate: BlueprintCandidate,
  bundleId: string,
): BundleFile[] {
  const files: BundleFile[] = [];
  files.push({
    name: "README.md",
    content: `# Matrix Bundle — ${candidate.name}

> A controlled build contract, not a vague prompt.

Idea: ${idea}
Blueprint: ${candidate.tier}
Bundle: ${bundleId}
Bundle URL: ${bundleUrl(bundleId)}
Stack: ${candidate.stack.join(", ")}

## How to build

1. Read MATRIX_BLUEPRINT.yaml.
2. Follow MATRIX_TASKS.md, one task at a time.
3. Stay inside MATRIX_ALLOWED_CHANGES.md.
4. Pass MATRIX_ACCEPTANCE_CRITERIA.md.
5. Run MATRIX_VALIDATION.md before finishing.

Send this bundle to an AI coder using one of the prompts in coder-prompts/.
`,
  });

  files.push({
    name: "MATRIX_BLUEPRINT.yaml",
    content: `apiVersion: matrix.builder/v1
kind: Blueprint
metadata:
  name: ${candidate.name}
  tier: ${candidate.tier.toLowerCase()}
  bundle: ${bundleId}
idea: >
  ${idea}
stack:
${candidate.stack.map((item) => `  - ${item}`).join("\n")}
architecture:
  frontend: ${candidate.stack.includes("React") ? "react" : "none"}
  backend: fastapi
  database: ${candidate.stack.includes("Postgres") ? "postgres" : "sqlite"}
  deploy: ${candidate.stack.includes("K8s") ? "kubernetes" : "docker"}
`,
  });

  files.push({
    name: "MATRIX_STANDARDS.lock",
    content: `# Locked standards — do not edit
${candidate.standards.map((standard) => `- ${standard}`).join("\n")}
`,
  });

  files.push({
    name: "MATRIX_TASKS.md",
    content: `# Tasks — implement one at a time

## Task 01 — Project scaffold
Create the folder structure and entrypoints defined in MATRIX_BLUEPRINT.yaml.

## Task 02 — Core domain
Implement the core logic for: ${idea}.

## Task 03 — API surface
Expose the documented endpoints and OpenAPI contract.

## Task 04 — Tests and validation
Add tests and pass MATRIX_VALIDATION.md.
`,
  });

  files.push({
    name: "MATRIX_ALLOWED_CHANGES.md",
    content: `# Allowed changes

- Files under src/, app/, tests/, frontend/, backend/, worker/
- New routes that match MATRIX_BLUEPRINT.yaml
- Tests that prove the selected task works

# Forbidden

- Editing MATRIX_* control files
- New top-level dependencies not approved by MATRIX_STANDARDS.lock
- Changing the architecture
- Adding external SaaS, auth, background workers, or new databases without approval
`,
  });

  files.push({
    name: "MATRIX_ACCEPTANCE_CRITERIA.md",
    content: `# Acceptance criteria

- Current task implemented and tested
- Lints clean against MATRIX_STANDARDS.lock
- API matches the documented contract
- No secrets committed
- No forbidden files changed
`,
  });

  files.push({
    name: "MATRIX_VALIDATION.md",
    content: `# Validation

Run:

\`\`\`bash
make validate
\`\`\`

The build is approved only when validation passes with no architecture, dependency, or file-policy drift.
`,
  });

  files.push({
    name: "docs/architecture.md",
    content: `# Architecture

This project is generated from a Matrix Builder controlled blueprint.

- Idea: ${idea}
- Blueprint: ${candidate.name}
- Quality: ${candidate.tier}
- Engine: agent-generator
- Standard source: matrix-definitions
`,
  });

  files.push({
    name: "docs/security.md",
    content: `# Security

The AI coder must respect MATRIX_STANDARDS.lock and MATRIX_ALLOWED_CHANGES.md.

Forbidden changes include secrets, architecture drift, unapproved dependencies, and edits to MATRIX control files.
`,
  });

  files.push({
    name: "docs/standards-report.md",
    content: `# Standards report

${candidate.standards.map((standard) => `- ${standard}`).join("\n")}
`,
  });

  AI_CODERS.forEach((coder) => {
    files.push({
      name: `coder-prompts/${coder.id}.md`,
      content: createCoderPrompt(coder.id, idea, candidate, bundleId),
    });
  });

  return files;
}
