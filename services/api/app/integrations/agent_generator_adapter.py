from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from app.schemas.blueprint import BlueprintCandidate, BlueprintResult, BlueprintStack, BlueprintTask
from app.schemas.bundle import MatrixBundle
from app.schemas.common import ApiRoute, BundleFile, CoderId, QualityLevel, ValidationStatus
from app.schemas.idea import IdeaIntent, IdeaRequest
from app.schemas.prompt import PromptResponse
from app.schemas.validation import ValidationCheck, ValidationReport
from app.services.ai_coder_prompt_service import build_prompt_response
from app.services.ai_coder_prompt_service import normalize_coder as normalize_prompt_coder
from app.utils.hashing import sha256_text
from app.utils.ids import stable_id
from app.utils.time import utc_now


class AgentGeneratorUnavailableError(RuntimeError):
    """Raised when the real agent-generator engine is requested but unavailable."""


@dataclass(frozen=True)
class AgentGeneratorStatus:
    mode: str
    status: str
    engine: str
    boundary: str = "matrix-builder-orchestrates-agent-generator-generates"


# --- Continuous Build value objects (Batch C2) ---------------------------------------------
# Plain frozen dataclasses so both engine (SDK) and deterministic (mock) modes return the same
# shape; the WorkflowService maps these onto ORM rows.

@dataclass(frozen=True)
class BatchPlanResult:
    batch_id: str
    ordinal: int
    title: str
    goal_md: str
    change_type: str  # small-update|add-feature|fix-issue
    tasks: list[dict[str, Any]]
    allowed_files: list[str]
    forbidden_changes: list[str]
    acceptance_commands: list[str]
    change_summary: list[str]
    is_repair: bool


@dataclass(frozen=True)
class BatchPromptPack:
    coder: str
    prompt_text: str
    constraints: dict[str, Any]


@dataclass(frozen=True)
class ChangeValidationResult:
    status: str  # engine status verbatim: approved|needs-repair|rejected
    score: int
    findings: list[dict[str, Any]]
    tree_hash: str
    summary: str
    added: list[str]
    changed: list[str]
    deleted: list[str]


@dataclass(frozen=True)
class CommitDiffResult:
    base_commit_id: str | None
    head_commit_id: str
    patch: str


# Matrix control files must never be edited by a coder; changing them is a hard violation.
_CONTROL_FILES = frozenset(
    {
        "MATRIX_BLUEPRINT.yaml",
        "MATRIX_STANDARDS.lock",
        "MATRIX_TASKS.md",
        "MATRIX_ALLOWED_CHANGES.md",
        "MATRIX_ACCEPTANCE_CRITERIA.md",
        "MATRIX_VALIDATION.md",
    }
)
_DEFAULT_ALLOWED_ROOTS = ("frontend/", "backend/", "worker/", "tests/", "docs/")
_DEFAULT_FORBIDDEN = ("MATRIX_BLUEPRINT.yaml", "MATRIX_STANDARDS.lock", ".github/workflows/")


class AgentGeneratorAdapter:
    """Clean boundary between Matrix Builder and agent-generator.

    Matrix Builder must not duplicate generation logic. In production this adapter should call
    ``agent_generator.engine.AgentGenerator``. In local development and CI it uses a deterministic
    mock engine so the public API, UI, contracts, and tests remain runnable without credentials or
    external services.
    """

    def __init__(self, mode: str = "mock") -> None:
        self.mode = mode
        self._engine: Any | None = None
        if mode == "sdk":
            self._engine = self._load_sdk_engine()

    def status(self) -> dict[str, str]:
        if self.mode == "sdk" and self._engine is not None:
            return AgentGeneratorStatus(
                mode="sdk",
                status="connected",
                engine="agent-generator",
            ).__dict__
        return AgentGeneratorStatus(
            mode="mock",
            status="ready",
            engine="deterministic-dev-engine",
        ).__dict__

    def parse_idea(self, payload: IdeaRequest) -> IdeaIntent:
        if self._engine and hasattr(self._engine, "parse_idea"):
            return self._engine.parse_idea(payload)  # type: ignore[no-any-return]
        return IdeaIntent(
            normalized_idea=_normalize(payload.idea),
            build_type=payload.build_type,
            goal=payload.goal,
            preferred_coder=payload.preferred_coder,
            quality_level=payload.quality_level,
            constraints=payload.constraints,
        )

    def generate_blueprint_candidates(self, payload: IdeaRequest) -> list[BlueprintCandidate]:
        if self._engine and hasattr(self._engine, "generate_blueprint_candidates"):
            return self._engine.generate_blueprint_candidates(payload)  # type: ignore[no-any-return]

        idea = _normalize(payload.idea)
        slug = _slugify(idea)
        base_stack = _stack_for(payload.quality_level)
        return [
            BlueprintCandidate(
                candidate_id=stable_id("cand", f"{idea}:starter"),
                title="Starter controlled blueprint",
                slug=f"{slug}-starter",
                summary=f"Small controlled build package for: {idea[:120]}",
                quality_level=QualityLevel.STARTER,
                stack=["Next.js", "FastAPI", "SQLite"],
                recommended=payload.quality_level == QualityLevel.STARTER,
                estimated_files=18,
                estimated_effort="a weekend",
                difficulty="easy",
                standards_profile="starter",
                rationale="Fast validation path with Matrix control files and one focused task.",
                generator_actions=["create_control_files", "create_starter_scaffold", "create_prompt_pack"],
                validation_checks=["required_files_present", "control_files_unchanged"],
            ),
            BlueprintCandidate(
                candidate_id=stable_id("cand", f"{idea}:standard"),
                title="Standard Matrix Bundle",
                slug=slug,
                summary=f"Recommended controlled app blueprint for: {idea[:120]}",
                quality_level=QualityLevel.STANDARD,
                stack=base_stack,
                recommended=payload.quality_level != QualityLevel.STARTER,
                estimated_files=34,
                estimated_effort="about one week",
                difficulty="medium",
                standards_profile="standard",
                rationale="Best default: docs, tests, Matrix control files, standards lock, and AI-coder prompts.",
                generator_actions=["create_control_files", "create_prompt_pack", "create_validation_plan"],
                validation_checks=["required_files_present", "forbidden_changes_absent", "dependency_drift_absent"],
            ),
            BlueprintCandidate(
                candidate_id=stable_id("cand", f"{idea}:production"),
                title="Production-ready controlled blueprint",
                slug=f"{slug}-production",
                summary=f"Hardened Matrix Bundle with release evidence for: {idea[:120]}",
                quality_level=QualityLevel.PRODUCTION,
                stack=["Next.js", "FastAPI", "PostgreSQL", "Redis", "Docker"],
                recommended=payload.quality_level in {QualityLevel.PRODUCTION, QualityLevel.ENTERPRISE},
                estimated_files=64,
                estimated_effort="about three weeks",
                difficulty="hard",
                standards_profile="production",
                rationale="Use when publication, observability, SBOMs, and MatrixHub trust metadata are required.",
                generator_actions=["create_signed_bundle", "create_prompt_pack", "create_release_evidence"],
                validation_checks=["sbom_present", "attestation_present", "policy_validation_passes"],
            ),
        ]

    def generate_controlled_blueprint(
        self,
        payload: IdeaRequest,
        candidate_id: str | None = None,
    ) -> BlueprintResult:
        if self._engine and hasattr(self._engine, "generate_controlled_blueprint"):
            return self._engine.generate_controlled_blueprint(payload, candidate_id=candidate_id)  # type: ignore[no-any-return]

        candidates = self.generate_blueprint_candidates(payload)
        selected = _select_candidate(candidates, candidate_id)
        idea = _normalize(payload.idea)
        blueprint_id = stable_id("bp", f"{idea}:{selected.candidate_id}")
        return BlueprintResult(
            blueprint_id=blueprint_id,
            candidate_id=selected.candidate_id,
            name=selected.title,
            slug=selected.slug,
            idea=idea,
            quality_level=selected.quality_level,
            stack=BlueprintStack(
                frontend="nextjs",
                backend="fastapi",
                worker="python",
                database="postgresql" if selected.quality_level != QualityLevel.STARTER else "sqlite",
                auth="none" if not payload.constraints.requires_auth else "session",
                deploy="docker",
            ),
            pages=["/", "/matrix-builder", "/builder/bundle/[bundleId]", "/builder/validate"],
            services=["frontend", "api", "worker"],
            api_routes=[
                ApiRoute(method="GET", path="/api/v1/health", summary="Health check"),
                ApiRoute(method="POST", path="/api/v1/ideas/parse", summary="Normalize an idea"),
                ApiRoute(method="POST", path="/api/v1/blueprints/candidates", summary="Create blueprint candidates"),
                ApiRoute(method="POST", path="/api/v1/bundles", summary="Generate a Matrix Bundle"),
                ApiRoute(method="GET", path="/api/v1/bundles/{bundle_id}/prompt/{coder}", summary="Read a coder prompt"),
                ApiRoute(method="POST", path="/api/v1/bundles/{bundle_id}/validate", summary="Validate a bundle"),
            ],
            required_files=[
                "README.md",
                "MATRIX_BLUEPRINT.yaml",
                "MATRIX_STANDARDS.lock",
                "MATRIX_TASKS.md",
                "MATRIX_ALLOWED_CHANGES.md",
                "MATRIX_ACCEPTANCE_CRITERIA.md",
                "MATRIX_VALIDATION.md",
                "docs/architecture.md",
                "docs/security.md",
                "docs/standards-report.md",
            ],
            allowed_change_roots=["frontend/", "backend/", "worker/", "tests/"],
            forbidden_changes=["MATRIX_BLUEPRINT.yaml", "MATRIX_STANDARDS.lock", ".github/workflows/"],
            tasks=[
                BlueprintTask(
                    task_id="TASK-001",
                    title="Implement the first controlled route and tests",
                    allowed_files=["backend/app/api/routes.py", "backend/tests/test_routes.py"],
                    acceptance_criteria=[
                        "Endpoint exists",
                        "Tests pass",
                        "No Matrix control files changed",
                    ],
                ),
                BlueprintTask(
                    task_id="TASK-002",
                    title="Implement the first user-facing screen",
                    allowed_files=["frontend/app/page.tsx", "frontend/components/hero.tsx"],
                    acceptance_criteria=["Responsive layout", "No unapproved dependencies"],
                ),
            ],
            acceptance_commands=["pytest -q", "ruff check .", "npm run build"],
            standards_lock_ref="MATRIX_STANDARDS.lock",
        )

    def generate_matrix_bundle(
        self,
        blueprint: BlueprintResult,
        preferred_coder: CoderId = CoderId.GENERIC_AI_CODER,
    ) -> MatrixBundle:
        if self._engine and hasattr(self._engine, "generate_matrix_bundle"):
            return self._engine.generate_matrix_bundle(blueprint, preferred_coder=preferred_coder)  # type: ignore[no-any-return]

        bundle_id = stable_id("bundle", f"{blueprint.blueprint_id}:{preferred_coder}")
        now = utc_now()
        digest_input = "|".join([blueprint.blueprint_id, blueprint.slug, preferred_coder])
        files = [BundleFile(path=path, kind=kind, required=True) for path, kind in _bundle_files()]
        return MatrixBundle(
            bundle_id=bundle_id,
            blueprint_id=blueprint.blueprint_id,
            title=f"{blueprint.name} Bundle",
            status="ready",
            created_at=now,
            expires_at=None,
            bundle_url=f"/api/v1/bundles/{bundle_id}",
            download_url=f"/api/v1/bundles/{bundle_id}/download",
            manifest_digest=sha256_text(digest_input),
            files=files,
            prompts_available=list(CoderId),
            standards=["RMD-001", "RMD-002", "RMD-003", "RMD-107", "AGENT-001", "GHA-001"],
            validation=ValidationStatus.NOT_RUN,
            links={
                "self": f"/api/v1/bundles/{bundle_id}",
                "download": f"/api/v1/bundles/{bundle_id}/download",
                "prompt": f"/api/v1/bundles/{bundle_id}/prompt/{preferred_coder}",
            },
        )

    def generate_coder_prompt(
        self,
        bundle_id: str,
        coder: CoderId | str,
        bundle_url: str | None = None,
    ) -> PromptResponse:
        coder_id = normalize_prompt_coder(coder)
        if self._engine and hasattr(self._engine, "generate_coder_prompt_pack"):
            return self._engine.generate_coder_prompt_pack(bundle_id=bundle_id, coder=coder_id)  # type: ignore[no-any-return]

        return build_prompt_response(bundle_id=bundle_id, coder=coder_id, bundle_url=bundle_url)

    def validate_bundle(self, bundle_id: str) -> ValidationReport:
        if self._engine and hasattr(self._engine, "validate_ai_coder_patch"):
            return self._engine.validate_ai_coder_patch(bundle_id=bundle_id)  # type: ignore[no-any-return]
        return ValidationReport(
            report_id=stable_id("val", bundle_id),
            bundle_id=bundle_id,
            status=ValidationStatus.NOT_RUN,
            score=0,
            violations=[],
            repair_prompt=None,
            checks=[
                ValidationCheck(
                    check_id="adapter_boundary",
                    status="passed",
                    message="Matrix Builder delegated validation to the agent-generator adapter boundary.",
                ),
                ValidationCheck(
                    check_id="matrix_definitions_required",
                    status="passed",
                    message="Validation requires MATRIX_STANDARDS.lock from matrix-definitions.",
                ),
            ],
            created_at=utc_now(),
        )

    # --- Continuous Build: incremental batches (Batch C2) ----------------------------------

    def plan_batch(
        self,
        *,
        version_label: str,
        goal_md: str,
        change_type: str = "add-feature",
        ordinal: int = 1,
        parent_commit_id: str | None = None,
        blueprint: Any | None = None,
    ) -> BatchPlanResult:
        """Plan the next batch *inside the current version* ("Continue build").

        SDK mode delegates to the v1.1.0 engine's ``plan_batch``; mock mode fabricates a
        deterministic, contract-shaped plan so the API and tests run without the engine.
        """
        if self._engine and hasattr(self._engine, "plan_batch") and blueprint is not None:
            plan = self._engine.plan_batch(
                blueprint, goal_md, change_type, ordinal=ordinal, parent_commit=parent_commit_id
            )
            return _batch_plan_from_engine(plan)

        batch_id = stable_id("bat", f"{version_label}:{ordinal}:{change_type}:{goal_md}")
        title = _title_from_goal(goal_md)
        task = {
            "task_id": f"TASK-{ordinal:03d}",
            "title": title,
            "allowed_files": ["backend/app/", "frontend/app/", "tests/"],
            "acceptance_criteria": [
                "Implements the stated goal",
                "Tests pass",
                "No Matrix control files changed",
            ],
        }
        return BatchPlanResult(
            batch_id=batch_id,
            ordinal=ordinal,
            title=title,
            goal_md=goal_md,
            change_type=change_type,
            tasks=[task],
            allowed_files=list(_DEFAULT_ALLOWED_ROOTS),
            forbidden_changes=list(_DEFAULT_FORBIDDEN),
            acceptance_commands=["pytest -q", "ruff check ."],
            change_summary=[goal_md.strip()[:120] or title],
            is_repair=False,
        )

    def plan_repair_batch(
        self,
        *,
        version_label: str,
        validation: ChangeValidationResult,
        ordinal: int = 1,
        parent_commit_id: str | None = None,
        blueprint: Any | None = None,
    ) -> BatchPlanResult:
        """Turn a failing validation result into a ``fix-issue`` batch scoped to the bad files."""
        if self._engine and hasattr(self._engine, "plan_repair_batch") and validation.findings:
            try:
                report = self._engine_report_from_validation(validation)
                plan = self._engine.plan_repair_batch(
                    report, blueprint=blueprint, ordinal=ordinal, parent_commit=parent_commit_id
                )
                return _batch_plan_from_engine(plan)
            except Exception:  # pragma: no cover - degraded to deterministic repair
                pass

        bad_files = sorted({f["file_path"] for f in validation.findings if f.get("file_path")})
        goal_md = "Repair the validation findings from the previous submission:\n" + "\n".join(
            f"- {f['check_name']}: {f['message']}" for f in validation.findings
        )
        batch_id = stable_id("bat", f"repair:{version_label}:{ordinal}:{validation.tree_hash}")
        task = {
            "task_id": f"TASK-{ordinal:03d}-FIX",
            "title": "Fix validation findings",
            "allowed_files": bad_files or ["backend/app/", "frontend/app/"],
            "acceptance_criteria": [
                "All previously failing checks pass",
                "No Matrix control files changed",
            ],
        }
        return BatchPlanResult(
            batch_id=batch_id,
            ordinal=ordinal,
            title="Repair batch",
            goal_md=goal_md,
            change_type="fix-issue",
            tasks=[task],
            allowed_files=bad_files or list(_DEFAULT_ALLOWED_ROOTS),
            forbidden_changes=list(_DEFAULT_FORBIDDEN),
            acceptance_commands=["pytest -q", "ruff check ."],
            change_summary=["Repair: " + ", ".join(f["check_name"] for f in validation.findings)],
            is_repair=True,
        )

    def batch_prompt_pack(
        self,
        *,
        plan: BatchPlanResult,
        coder: CoderId | str,
        bundle_url: str | None = None,
    ) -> BatchPromptPack:
        """Emit the AI-coder prompt for a planned batch (scoped to this batch only)."""
        coder_id = normalize_prompt_coder(coder)
        constraints = {
            "allowed_files": plan.allowed_files,
            "forbidden_changes": plan.forbidden_changes,
            "acceptance_commands": plan.acceptance_commands,
            "parent_commit_id": None,
            "is_repair": plan.is_repair,
        }
        if self._engine and hasattr(self._engine, "coder_handoff"):
            try:
                handoff = self._engine.coder_handoff(
                    {}, coder_id, batch=plan, bundle_url=bundle_url
                )
                return BatchPromptPack(
                    coder=coder_id.value, prompt_text=handoff.prompt, constraints=constraints
                )
            except Exception:  # pragma: no cover - degraded to deterministic prompt
                pass

        tasks_md = "\n".join(f"- {t['task_id']}: {t['title']}" for t in plan.tasks)
        allowed_md = "\n".join(f"- {p}" for p in plan.allowed_files)
        forbidden_md = "\n".join(f"- {p}" for p in plan.forbidden_changes)
        prompt_text = (
            f"# Matrix Batch Prompt — {plan.title}\n\n"
            f"Coder: {coder_id.value}\n"
            f"Change type: {plan.change_type}\n\n"
            f"## Goal\n{plan.goal_md}\n\n"
            f"## Tasks (this batch only)\n{tasks_md}\n\n"
            f"## You may edit ONLY\n{allowed_md}\n\n"
            f"## You must NOT change\n{forbidden_md}\n\n"
            f"## Acceptance\n" + "\n".join(f"- `{c}`" for c in plan.acceptance_commands) + "\n"
        )
        return BatchPromptPack(
            coder=coder_id.value, prompt_text=prompt_text, constraints=constraints
        )

    def validate_changes(
        self,
        *,
        changed_files: list[dict[str, Any]],
        allowed_files: list[str] | None = None,
        forbidden_changes: list[str] | None = None,
        patch: str | None = None,
        blueprint: Any | None = None,
    ) -> ChangeValidationResult:
        """Validate a submitted change set against the Matrix contract.

        The deterministic contract check (control files untouched, changes within the allowlist)
        is the canonical metadata-level authority and is used in mock mode and CI. When the SDK
        engine is present and a real ``patch`` is supplied, validation is delegated to it.
        """
        if self._engine and hasattr(self._engine, "validate_ai_coder_patch") and patch and blueprint is not None:
            try:
                report = self._engine.validate_ai_coder_patch(patch=patch, blueprint=blueprint)
                return _validation_from_report(report, changed_files)
            except Exception:  # pragma: no cover - degraded to deterministic check
                pass

        allowed = tuple(allowed_files or _DEFAULT_ALLOWED_ROOTS)
        forbidden = tuple(forbidden_changes or _DEFAULT_FORBIDDEN)
        paths = [str(f["path"]) for f in changed_files]

        added, changed, deleted = [], [], []
        for f in changed_files:
            kind = str(f.get("change_type", "modified"))
            p = str(f["path"])
            (added if kind == "added" else deleted if kind == "deleted" else changed).append(p)

        findings: list[dict[str, Any]] = []
        for p in paths:
            if _is_forbidden(p, forbidden):
                findings.append(
                    {
                        "severity": "error",
                        "status": "failed",
                        "check_name": "forbidden_changes_absent",
                        "file_path": p,
                        "message": f"Matrix control file '{p}' must not be modified.",
                        "remediation": "Revert this file; control files are immutable for coders.",
                    }
                )
        for p in paths:
            if not _is_forbidden(p, forbidden) and not _within_allowlist(p, allowed):
                findings.append(
                    {
                        "severity": "warning",
                        "status": "failed",
                        "check_name": "changes_within_allowlist",
                        "file_path": p,
                        "message": f"'{p}' is outside the allowed change roots {list(allowed)}.",
                        "remediation": "Move the change into an allowed directory or update the batch scope.",
                    }
                )

        has_error = any(f["severity"] == "error" for f in findings)
        has_warning = any(f["severity"] == "warning" for f in findings)
        if has_error:
            status, score = "rejected", 0
        elif has_warning:
            status, score = "needs-repair", 60
        else:
            status, score = "approved", 100
            findings.append(
                {
                    "severity": "info",
                    "status": "passed",
                    "check_name": "required_files_present",
                    "file_path": None,
                    "message": "All changes are within scope and no control files were modified.",
                    "remediation": None,
                }
            )

        tree_hash = sha256_text("|".join(sorted(paths)))
        summary = f"{len(added)} added, {len(changed)} changed, {len(deleted)} deleted"
        return ChangeValidationResult(
            status=status,
            score=score,
            findings=findings,
            tree_hash=tree_hash,
            summary=summary,
            added=sorted(added),
            changed=sorted(changed),
            deleted=sorted(deleted),
        )

    def diff_commits(
        self,
        *,
        head_commit_id: str,
        head_manifest: dict[str, Any],
        base_commit_id: str | None = None,
        base_manifest: dict[str, Any] | None = None,
    ) -> CommitDiffResult:
        """Produce a deterministic unified-diff-style summary between two commit manifests."""
        base_manifest = base_manifest or {}
        lines = [
            f"--- {base_commit_id or 'EMPTY'}",
            f"+++ {head_commit_id}",
        ]
        for path in head_manifest.get("added", []):
            lines.append(f"A {path}")
        for path in head_manifest.get("changed", []):
            lines.append(f"M {path}")
        for path in head_manifest.get("deleted", []):
            lines.append(f"D {path}")
        return CommitDiffResult(
            base_commit_id=base_commit_id,
            head_commit_id=head_commit_id,
            patch="\n".join(lines) + "\n",
        )

    def _engine_report_from_validation(self, validation: ChangeValidationResult) -> Any:
        # Best-effort reconstruction of an engine ValidationReport for plan_repair_batch.
        from agent_generator.contracts.validation import (
            ValidationReport,  # type: ignore[import-not-found]
        )

        return ValidationReport(
            report_id=stable_id("val", validation.tree_hash),
            bundle_id=validation.tree_hash,
            status=validation.status,
            score=validation.score,
            violations=[f["message"] for f in validation.findings if f.get("severity") == "error"],
            repair_prompt=None,
            checks=[],
            created_at=utc_now(),
        )

    def _load_sdk_engine(self) -> Any:
        try:
            from agent_generator.engine import AgentGenerator  # type: ignore[import-not-found]
        except Exception as exc:  # pragma: no cover - exercised only when SDK missing in real mode
            raise AgentGeneratorUnavailableError(
                "AGENT_GENERATOR_MODE=sdk was requested, but agent-generator is not importable."
            ) from exc
        return AgentGenerator()


def _normalize(value: str) -> str:
    return " ".join(value.strip().split())


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:72] or "matrix-project"


def _stack_for(level: QualityLevel) -> list[str]:
    if level == QualityLevel.STARTER:
        return ["Next.js", "FastAPI", "SQLite"]
    if level in {QualityLevel.PRODUCTION, QualityLevel.ENTERPRISE}:
        return ["Next.js", "FastAPI", "PostgreSQL", "Redis", "Docker"]
    return ["Next.js", "FastAPI", "PostgreSQL", "Docker"]


def _select_candidate(
    candidates: list[BlueprintCandidate],
    candidate_id: str | None,
) -> BlueprintCandidate:
    if candidate_id:
        for candidate in candidates:
            if candidate.candidate_id == candidate_id:
                return candidate
    for candidate in candidates:
        if candidate.recommended:
            return candidate
    return candidates[0]


def _normalize_coder(coder: str) -> str:
    return normalize_prompt_coder(coder).value


def _contract_files() -> list[str]:
    return [
        "MATRIX_BLUEPRINT.yaml",
        "MATRIX_STANDARDS.lock",
        "MATRIX_TASKS.md",
        "MATRIX_ALLOWED_CHANGES.md",
        "MATRIX_ACCEPTANCE_CRITERIA.md",
        "MATRIX_VALIDATION.md",
    ]


def _bundle_files() -> list[tuple[str, str]]:
    return [
        ("README.md", "doc"),
        ("MATRIX_BLUEPRINT.yaml", "control"),
        ("MATRIX_STANDARDS.lock", "control"),
        ("MATRIX_TASKS.md", "control"),
        ("MATRIX_ALLOWED_CHANGES.md", "control"),
        ("MATRIX_ACCEPTANCE_CRITERIA.md", "control"),
        ("MATRIX_VALIDATION.md", "control"),
        ("docs/architecture.md", "doc"),
        ("docs/security.md", "doc"),
        ("docs/standards-report.md", "doc"),
        ("coder-prompts/claude-code.md", "prompt"),
        ("coder-prompts/codex-chatgpt.md", "prompt"),
        ("coder-prompts/cursor.md", "prompt"),
        ("coder-prompts/ibm-bob.md", "prompt"),
        ("coder-prompts/gitpilot.md", "prompt"),
        ("coder-prompts/generic-ai-coder.md", "prompt"),
        ("artifacts/manifest.json", "manifest"),
    ]


def _prompt_for(coder: str, bundle_id: str, fetch_url: str) -> str:
    return build_prompt_response(bundle_id=bundle_id, coder=coder, bundle_url=fetch_url).prompt


def _title_from_goal(goal_md: str) -> str:
    first = goal_md.strip().splitlines()[0] if goal_md.strip() else "Continue build"
    first = first.lstrip("# ").strip()
    return (first[:80] or "Continue build").strip()


def _is_forbidden(path: str, forbidden: tuple[str, ...]) -> bool:
    base = path.rsplit("/", 1)[-1]
    if base in _CONTROL_FILES or base.startswith("MATRIX_"):
        return True
    return any(path == f or path.startswith(f) for f in forbidden)


def _within_allowlist(path: str, allowed: tuple[str, ...]) -> bool:
    return any(path == a or path.startswith(a) for a in allowed)


def _batch_plan_from_engine(plan: Any) -> BatchPlanResult:
    """Map the engine's ``BatchPlan`` (pydantic) onto the adapter's plain result."""
    tasks = [t.model_dump() if hasattr(t, "model_dump") else dict(t) for t in plan.tasks]
    change_type = plan.change_type.value if hasattr(plan.change_type, "value") else str(plan.change_type)
    return BatchPlanResult(
        batch_id=plan.batch_id,
        ordinal=plan.ordinal,
        title=plan.title,
        goal_md=plan.goal_md,
        change_type=change_type,
        tasks=tasks,
        allowed_files=list(plan.allowed_files),
        forbidden_changes=list(getattr(plan, "forbidden_changes", _DEFAULT_FORBIDDEN)),
        acceptance_commands=list(plan.acceptance_commands),
        change_summary=list(plan.change_summary),
        is_repair=bool(plan.is_repair),
    )


def _validation_from_report(report: Any, changed_files: list[dict[str, Any]]) -> ChangeValidationResult:
    """Map the engine's ``ValidationReport`` onto the adapter's plain result (status verbatim)."""
    status = report.status.value if hasattr(report.status, "value") else str(report.status)
    findings = []
    for check in getattr(report, "checks", []):
        findings.append(
            {
                "severity": "error" if getattr(check, "status", "") == "failed" else "info",
                "status": getattr(check, "status", "passed"),
                "check_name": getattr(check, "check_id", "check"),
                "file_path": getattr(check, "file_path", None),
                "message": getattr(check, "message", ""),
                "remediation": None,
            }
        )
    paths = sorted(str(f["path"]) for f in changed_files)
    return ChangeValidationResult(
        status=status,
        score=int(getattr(report, "score", 0) or 0),
        findings=findings,
        tree_hash=sha256_text("|".join(paths)),
        summary=f"{len(changed_files)} files",
        added=[],
        changed=paths,
        deleted=[],
    )
