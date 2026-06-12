from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from app.schemas.blueprint import BlueprintCandidate, BlueprintResult, BlueprintStack, BlueprintTask
from app.schemas.bundle import MatrixBundle
from app.schemas.common import ApiRoute, BundleFile, CoderId, QualityLevel, ValidationStatus
from app.schemas.idea import IdeaIntent, IdeaRequest
from app.schemas.prompt import PromptResponse
from app.services.ai_coder_prompt_service import build_prompt_response, normalize_coder as normalize_prompt_coder
from app.schemas.validation import ValidationCheck, ValidationReport
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
