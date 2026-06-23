from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from app.schemas.common import CoderId
from app.schemas.prompt import PromptItem, PromptPack, PromptResponse
from app.utils.ids import stable_id

CONTRACT_FILES = [
    "README.md",
    "MATRIX_BLUEPRINT.yaml",
    "MATRIX_STANDARDS.lock",
    "MATRIX_TASKS.md",
    "MATRIX_ALLOWED_CHANGES.md",
    "MATRIX_ACCEPTANCE_CRITERIA.md",
    "MATRIX_VALIDATION.md",
]

DEFAULT_ALLOWED_FILES = [
    "backend/app/api/routes.py",
    "backend/tests/test_routes.py",
    "frontend/app/page.tsx",
    "frontend/components/hero.tsx",
    "tests/",
]

DEFAULT_VALIDATION_COMMANDS = [
    "pytest -q",
    "ruff check .",
    "npm run build",
]

# The canonical Ruslan Magana Definitions (RMD) pack — the full text of the rules that
# MATRIX_STANDARDS.lock only pins by id, plus the approved technology baseline. The prompt
# hands the coder a fetchable URL so it can read the rules it must obey, not just cite them.
DEFINITIONS_URL = "https://agent-matrix.github.io/matrix-definitions/definitions/"

CODER_ALIASES = {
    "claude": CoderId.CLAUDE_CODE,
    "claude_code": CoderId.CLAUDE_CODE,
    "claude-code": CoderId.CLAUDE_CODE,
    "codex": CoderId.CODEX_CHATGPT,
    "chatgpt": CoderId.CODEX_CHATGPT,
    "codex-chatgpt": CoderId.CODEX_CHATGPT,
    "cursor": CoderId.CURSOR,
    "gitpilot": CoderId.GITPILOT,
    "bob": CoderId.IBM_BOB,
    "ibm-bob": CoderId.IBM_BOB,
    "generic": CoderId.GENERIC_AI_CODER,
    "generic-ai-coder": CoderId.GENERIC_AI_CODER,
}


@dataclass(frozen=True)
class CoderPromptPolicy:
    coder: CoderId
    label: str
    path: str
    summary: str
    handoff_mode: str
    output_format: str
    extra_rules: tuple[str, ...]


CODER_POLICIES: dict[CoderId, CoderPromptPolicy] = {
    CoderId.CLAUDE_CODE: CoderPromptPolicy(
        coder=CoderId.CLAUDE_CODE,
        label="Claude Code controlled implementation prompt",
        path="coder-prompts/claude-code.md",
        summary="Best for local repository edits through Claude Code.",
        handoff_mode="Fetch the Matrix Bundle, read README.md, then implement the selected task in the local workspace.",
        output_format="Return a concise plan, files changed, commands run, and remaining blockers.",
        extra_rules=(
            "Use Claude Code as an implementation worker, not as the product architect.",
            "Before editing, summarize the Matrix task and allowed files you will touch.",
            "Stop if the requested change requires editing MATRIX_* files or changing the stack.",
        ),
    ),
    CoderId.CODEX_CHATGPT: CoderPromptPolicy(
        coder=CoderId.CODEX_CHATGPT,
        label="Codex / ChatGPT controlled implementation prompt",
        path="coder-prompts/codex-chatgpt.md",
        summary="Best for copy-paste patch generation and ChatGPT coding workflows.",
        handoff_mode="Use the Matrix Bundle as the only source of project truth and produce one scoped implementation patch.",
        output_format="Return unified diff or exact files changed, commands to run, and pass/fail for each acceptance criterion.",
        extra_rules=(
            "Do not invent files, services, APIs, auth, or dependencies that are not in the Matrix Bundle.",
            "When context is missing, ask for the missing Matrix control file instead of guessing.",
            "Keep the output patch-scoped and avoid broad refactors.",
        ),
    ),
    CoderId.CURSOR: CoderPromptPolicy(
        coder=CoderId.CURSOR,
        label="Cursor controlled implementation prompt",
        path="coder-prompts/cursor.md",
        summary="Best for editing an open workspace with Composer or chat.",
        handoff_mode="Open the bundle in the workspace and apply only the current Matrix task.",
        output_format="Finish with a change summary, file list, validation commands, and policy blockers.",
        extra_rules=(
            "Use Cursor workspace context only after the Matrix contract has been read.",
            "Do not use repo-wide edit mode for files outside the allowed list.",
            "If Cursor suggests unrelated cleanup, reject it unless it is in the current task.",
        ),
    ),
    CoderId.GITPILOT: CoderPromptPolicy(
        coder=CoderId.GITPILOT,
        label="GitPilot controlled implementation prompt",
        path="coder-prompts/gitpilot.md",
        summary="Best for RuslanMV GitPilot workflows with planner/coder/reviewer roles.",
        handoff_mode="Give GitPilot the bundle URL and instruct Explorer, Planner, Coder, and Reviewer to obey the Matrix contract.",
        output_format="Return role-by-role summary, files changed, validation evidence, and approval status.",
        extra_rules=(
            "Explorer may inspect the bundle but must not expand scope.",
            "Planner must choose one Matrix task and preserve architecture.",
            "Coder edits only allowed files; Reviewer verifies MATRIX_VALIDATION.md before approval.",
        ),
    ),
    CoderId.IBM_BOB: CoderPromptPolicy(
        coder=CoderId.IBM_BOB,
        label="IBM Bob controlled implementation prompt",
        path="coder-prompts/ibm-bob.md",
        summary="Best for enterprise controlled coding workflows.",
        handoff_mode="Use the Matrix Bundle as a governed work item with explicit acceptance and validation evidence.",
        output_format="Return implementation summary, changed files, compliance evidence, and validation commands run.",
        extra_rules=(
            "Treat MATRIX_STANDARDS.lock as a governance artifact.",
            "Do not introduce new services, dependencies, or data flows without approval.",
            "Prefer small enterprise-safe changes with auditable reasoning.",
        ),
    ),
    CoderId.GENERIC_AI_CODER: CoderPromptPolicy(
        coder=CoderId.GENERIC_AI_CODER,
        label="Generic AI coder controlled implementation prompt",
        path="coder-prompts/generic-ai-coder.md",
        summary="Safe fallback for any coding assistant.",
        handoff_mode="Paste the prompt and attach or link the Matrix Bundle before asking for code.",
        output_format="Return files changed, commands run, validation result, and blockers.",
        extra_rules=(
            "If the AI coder cannot read the bundle URL, manually paste README.md and the MATRIX_* control files.",
            "Never ask for an open-ended implementation; ask for one Matrix task only.",
            "Reject suggestions that bypass validation or add unapproved dependencies.",
        ),
    ),
}


def normalize_coder(coder: CoderId | str) -> CoderId:
    if isinstance(coder, CoderId):
        return coder
    normalized = str(coder).strip().lower().replace("_", "-")
    if normalized not in CODER_ALIASES:
        return CoderId.GENERIC_AI_CODER
    return CODER_ALIASES[normalized]


def prompt_path(coder: CoderId | str) -> str:
    return CODER_POLICIES[normalize_coder(coder)].path


def build_fetch_url(bundle_id: str, base_url: str | None = None) -> str:
    base = (base_url or "https://api.ruslanmv.com/v1/matrix-bundles").rstrip("/")
    if base.endswith(bundle_id):
        return base
    return f"{base}/{bundle_id}"


def build_prompt_content(
    bundle_id: str,
    coder: CoderId | str,
    bundle_url: str | None = None,
    task_id: str = "TASK-001",
    allowed_files: Iterable[str] | None = None,
    validation_commands: Iterable[str] | None = None,
) -> str:
    coder_id = normalize_coder(coder)
    policy = CODER_POLICIES[coder_id]
    files = list(allowed_files or DEFAULT_ALLOWED_FILES)
    commands = list(validation_commands or DEFAULT_VALIDATION_COMMANDS)
    fetch_url = bundle_url or build_fetch_url(bundle_id)
    extra_rules = "\n".join(f"- {rule}" for rule in policy.extra_rules)
    files_text = "\n".join(f"- `{path}`" for path in files)
    commands_text = "\n".join(f"- `{command}`" for command in commands)
    contract_text = "\n".join(f"- `{path}`" for path in CONTRACT_FILES)

    return f"""# {policy.label}

You are using **{policy.coder.value}** to implement a Matrix Builder controlled project.

**AI coders are workers, not architects.** You are not the architect. You are the implementation worker. Your job is to implement the assigned Matrix task inside the contract. Do not redesign the product, stack, routes, services, data model, or standards lock.

## Fetch this Matrix Bundle

{fetch_url}

Bundle ID: {bundle_id}
Task: `{task_id}`

## Download the Ruslan Definitions

{DEFINITIONS_URL}

This is the RMD pack: the full text of `RMD-001`…`RMD-120` plus the approved technology baseline (stacks, security, CI). `MATRIX_STANDARDS.lock` in the bundle pins the exact version you must follow. Read the definitions before you write code — the lock cites rule ids, this is what they mean.

## Read first

{contract_text}

## Handoff mode

{policy.handoff_mode}

## Allowed files for this task

{files_text}

## Hard constraints

- Implement `{task_id}` only.
- Edit only the allowed files listed above.
- Do not modify `MATRIX_BLUEPRINT.yaml`, `MATRIX_STANDARDS.lock`, or other Matrix control files.
- Do not add unapproved dependencies, external services, auth systems, queues, databases, or background workers.
- Do not change architecture, stack, routes, service boundaries, deployment model, or standards profile.
- Do not insert secrets or credentials.
- Stop and report a blocker when the request conflicts with the Matrix contract.

## Coder-specific rules

{extra_rules}

## Validation commands

{commands_text}

## Required response

{policy.output_format}

End your response with exactly one of these statuses:

- `MATRIX_STATUS: READY_FOR_VALIDATION`
- `MATRIX_STATUS: BLOCKED_BY_CONTRACT`
- `MATRIX_STATUS: NEEDS_HUMAN_APPROVAL`
"""


def build_prompt_response(
    bundle_id: str,
    coder: CoderId | str,
    bundle_url: str | None = None,
    task_id: str = "TASK-001",
    allowed_files: Iterable[str] | None = None,
    validation_commands: Iterable[str] | None = None,
) -> PromptResponse:
    coder_id = normalize_coder(coder)
    files = list(allowed_files or DEFAULT_ALLOWED_FILES)
    commands = list(validation_commands or DEFAULT_VALIDATION_COMMANDS)
    fetch_url = bundle_url or build_fetch_url(bundle_id)
    return PromptResponse(
        coder=coder_id,
        label=CODER_POLICIES[coder_id].label,
        path=CODER_POLICIES[coder_id].path,
        prompt=build_prompt_content(
            bundle_id=bundle_id,
            coder=coder_id,
            bundle_url=fetch_url,
            task_id=task_id,
            allowed_files=files,
            validation_commands=commands,
        ),
        bundle_id=bundle_id,
        bundle_url=fetch_url,
        task_id=task_id,
        contract_files=CONTRACT_FILES,
        allowed_files=files,
        validation_commands=commands,
        hard_constraints=[
            "AI coder is worker, not architect",
            "Implement one Matrix task only",
            "Edit only allowed files",
            "Do not modify Matrix control files",
            "Do not add unapproved dependencies",
            "Run validation before finishing",
        ],
        handoff_mode=CODER_POLICIES[coder_id].handoff_mode,
    )


def build_prompt_item(bundle_id: str, coder: CoderId | str, bundle_url: str | None = None) -> PromptItem:
    response = build_prompt_response(bundle_id, coder, bundle_url=bundle_url)
    return PromptItem(
        coder=normalize_coder(coder),
        label=response.label,
        path=response.path,
        content=response.prompt,
        contract_files=response.contract_files,
        allowed_files=response.allowed_files,
        validation_commands=response.validation_commands,
        hard_constraints=response.hard_constraints,
    )


def build_prompt_pack(
    bundle_id: str,
    blueprint_id: str,
    default_coder: CoderId | str = CoderId.CLAUDE_CODE,
    bundle_url: str | None = None,
) -> PromptPack:
    coder_id = normalize_coder(default_coder)
    return PromptPack(
        prompt_pack_id=stable_id("prompt_pack", f"{bundle_id}:{blueprint_id}"),
        bundle_id=bundle_id,
        blueprint_id=blueprint_id,
        default_coder=coder_id,
        prompts=[build_prompt_item(bundle_id, policy.coder, bundle_url=bundle_url) for policy in CODER_POLICIES.values()],
    )
