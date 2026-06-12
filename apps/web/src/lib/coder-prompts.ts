import type { BlueprintCandidate } from "@/types/blueprint";
import type { CoderId } from "@/types/coder";
import { AI_CODERS, BUNDLE_API_BASE, DEFAULT_ALLOWED_FILES, DEFAULT_VALIDATION_COMMANDS, MATRIX_CONTRACT_FILES } from "./constants";

export function bundleUrl(bundleId: string): string {
  return `${BUNDLE_API_BASE}/${bundleId}`;
}

function coderSpecificRules(coderId: CoderId): string[] {
  switch (coderId) {
    case "claude-code":
      return [
        "Use Claude Code as the local implementation worker, not the architect.",
        "Summarize the selected Matrix task before editing.",
        "Stop if the work requires architecture or dependency changes.",
      ];
    case "codex-chatgpt":
      return [
        "Produce one scoped patch or exact file changes.",
        "Do not invent files, services, auth, or dependencies outside the bundle.",
        "Ask for missing Matrix control files instead of guessing.",
      ];
    case "cursor":
      return [
        "Use workspace context only after reading the Matrix contract.",
        "Avoid repo-wide edits outside the allowed files.",
        "Reject unrelated refactors unless the task explicitly requests them.",
      ];
    case "gitpilot":
      return [
        "Explorer may inspect the bundle but must not expand scope.",
        "Planner must choose one Matrix task and preserve architecture.",
        "Coder edits only allowed files; Reviewer verifies MATRIX_VALIDATION.md.",
      ];
    case "ibm-bob":
      return [
        "Treat MATRIX_STANDARDS.lock as a governance artifact.",
        "Do not introduce new services, dependencies, or data flows without approval.",
        "Return validation evidence suitable for enterprise review.",
      ];
    default:
      return [
        "If you cannot fetch the bundle URL, ask the user to paste README.md and the MATRIX_* files.",
        "Implement only one Matrix task.",
        "Do not bypass validation.",
      ];
  }
}

export function createCoderPrompt(
  coderId: CoderId,
  idea: string,
  candidate: BlueprintCandidate,
  bundleId: string,
): string {
  const coder = AI_CODERS.find((item) => item.id === coderId) ?? AI_CODERS[AI_CODERS.length - 1];
  const rules = coderSpecificRules(coder.id).map((rule) => `- ${rule}`).join("\n");
  const contractFiles = MATRIX_CONTRACT_FILES.map((path) => `- \`${path}\``).join("\n");
  const allowedFiles = DEFAULT_ALLOWED_FILES.map((path) => `- \`${path}\``).join("\n");
  const validationCommands = DEFAULT_VALIDATION_COMMANDS.map((command) => `- \`${command}\``).join("\n");

  return `# ${coder.name} controlled implementation prompt

You are using ${coder.name} to implement a Matrix Builder controlled project.

AI coders are workers, not architects. You are not the architect. You are the implementation worker.

## Fetch this Matrix Bundle

${bundleUrl(bundleId)}

Project idea: ${idea}
Selected blueprint: ${candidate.name} (${candidate.tier})
Task: TASK-001

## Read first

${contractFiles}

## Allowed files for this task

${allowedFiles}

## Hard constraints

- Implement TASK-001 only.
- Edit only the allowed files listed above.
- Do not modify MATRIX_BLUEPRINT.yaml, MATRIX_STANDARDS.lock, or other Matrix control files.
- Do not add unapproved dependencies.
- Do not change architecture, stack, routes, services, or standards profile.
- Do not insert secrets.
- Stop and report a blocker if the request conflicts with the Matrix contract.

## ${coder.name} instructions

${rules}

## Validation commands

${validationCommands}

## Required response

Return:
1. Files changed.
2. Commands run.
3. Validation result.
4. Blockers if Matrix policy prevented a change.

End with one status:
- MATRIX_STATUS: READY_FOR_VALIDATION
- MATRIX_STATUS: BLOCKED_BY_CONTRACT
- MATRIX_STATUS: NEEDS_HUMAN_APPROVAL
`;
}
