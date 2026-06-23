import type { AiCoder } from "@/types/coder";

export const BUNDLE_API_BASE = "https://api.ruslanmv.com/v1/matrix-bundles";

// The canonical Ruslan Magana Definitions (RMD) pack — the full rule text + technology
// baseline that MATRIX_STANDARDS.lock pins by id. The controlled prompt points coders here.
export const DEFINITIONS_URL = "https://agent-matrix.github.io/matrix-definitions/definitions/";

export const IDEA_EXAMPLES = [
  "A GitHub repo intelligence agent",
  "A document Q&A assistant with citations",
  "A developer portfolio reviewer",
  "A trend scout for AI research topics",
  "A meeting-notes summarizer agent",
  "A REST API with auth and a dashboard",
  "A changelog & release-notes generator",
  "A Slack bot that triages support tickets",
  "A CLI that scaffolds microservices",
  "A security review agent for pull requests",
] as const;

export const AI_CODERS: AiCoder[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    url: "https://claude.ai/code",
    short: "Claude",
    promptPath: "coder-prompts/claude-code.md",
    handoff: "Send to a local Claude Code workspace after opening the Matrix Bundle.",
  },
  {
    id: "codex-chatgpt",
    name: "Codex / ChatGPT",
    url: "https://chatgpt.com/",
    short: "Codex",
    promptPath: "coder-prompts/codex-chatgpt.md",
    handoff: "Paste the controlled prompt and attach the bundle files or fetch URL.",
  },
  {
    id: "cursor",
    name: "Cursor",
    url: "https://cursor.com/",
    short: "Cursor",
    promptPath: "coder-prompts/cursor.md",
    handoff: "Open the generated workspace and use the prompt in Cursor Composer.",
  },
  {
    id: "gitpilot",
    name: "GitPilot",
    url: "https://github.com/ruslanmv/gitpilot",
    short: "GitPilot",
    promptPath: "coder-prompts/gitpilot.md",
    handoff: "Give GitPilot the bundle URL so Explorer, Planner, Coder, and Reviewer stay inside the contract.",
  },
  {
    id: "ibm-bob",
    name: "IBM Bob",
    url: "https://www.ibm.com/products/watsonx-code-assistant",
    short: "IBM Bob",
    promptPath: "coder-prompts/ibm-bob.md",
    handoff: "Use as a governed enterprise work item with validation evidence.",
  },
  {
    id: "generic-ai-coder",
    name: "Any AI coder",
    url: "",
    short: "Generic",
    promptPath: "coder-prompts/generic-ai-coder.md",
    handoff: "Paste the prompt and the Matrix control files into any AI coding assistant.",
  },
];

export const SCANNING_MESSAGES = [
  "Parsing your idea…",
  "Selecting standards",
  "Compiling blueprint candidates",
  "Locking the contract",
  "Packing your Matrix Bundle",
] as const;

export const MATRIX_CONTRACT_FILES = [
  "README.md",
  "MATRIX_BLUEPRINT.yaml",
  "MATRIX_STANDARDS.lock",
  "MATRIX_TASKS.md",
  "MATRIX_ALLOWED_CHANGES.md",
  "MATRIX_ACCEPTANCE_CRITERIA.md",
  "MATRIX_VALIDATION.md",
] as const;

export const DEFAULT_ALLOWED_FILES = [
  "backend/app/api/routes.py",
  "backend/tests/test_routes.py",
  "frontend/app/page.tsx",
  "frontend/components/hero.tsx",
  "tests/",
] as const;

export const DEFAULT_VALIDATION_COMMANDS = ["pytest -q", "ruff check .", "npm run build"] as const;
