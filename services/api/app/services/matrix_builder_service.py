from __future__ import annotations

from dataclasses import dataclass

from app.integrations.agent_generator_adapter import AgentGeneratorAdapter
from app.integrations.matrix_definitions_client import MatrixDefinitionsClient
from app.schemas.blueprint import BlueprintCandidate, BlueprintResult
from app.schemas.bundle import (
    BundleCleanupResponse,
    BundleGenerationRequest,
    BundleManifest,
    BundleSaveRequest,
    BundleSaveResponse,
    BundleTreeNode,
    MatrixBundle,
    QuotaStatus,
    SignedBundleUrlResponse,
)
from app.schemas.common import CoderId
from app.schemas.idea import IdeaIntent, IdeaRequest
from app.schemas.prompt import PromptResponse
from app.schemas.publication import PublicationRequest, PublicationResponse
from app.schemas.standards import StandardsStatus
from app.schemas.validation import ValidationReport, ValidationRequest
from app.integrations.drift_detection_adapter import DriftDetectionAdapter
from app.integrations.matrixhub_client import MatrixHubClient
from app.services.bundle_service import BundleStore, get_mock_bundle
from app.services.quota_service import QuotaService


@dataclass
class MatrixBuilderService:
    """Application orchestrator for Matrix Builder.

    Important separation:
    - Matrix Builder orchestrates the user/API flow.
    - agent-generator generates blueprints, bundles, prompts, and validation results.
    - matrix-definitions provides the standards/rules source of truth.
    """

    agent_generator: AgentGeneratorAdapter
    matrix_definitions: MatrixDefinitionsClient
    bundle_store: BundleStore | None = None
    quota_service: QuotaService | None = None
    drift_detector: DriftDetectionAdapter | None = None
    matrixhub_client: MatrixHubClient | None = None

    def __post_init__(self) -> None:
        if self.bundle_store is None:
            self.bundle_store = BundleStore()
        if self.quota_service is None:
            self.quota_service = QuotaService()
        if self.drift_detector is None:
            self.drift_detector = DriftDetectionAdapter()
        if self.matrixhub_client is None:
            self.matrixhub_client = MatrixHubClient()

    def parse_idea(self, payload: IdeaRequest) -> IdeaIntent:
        return self.agent_generator.parse_idea(payload)

    def generate_candidates(self, payload: IdeaRequest) -> list[BlueprintCandidate]:
        return self.agent_generator.generate_blueprint_candidates(payload)

    def generate_blueprint(
        self,
        payload: IdeaRequest,
        candidate_id: str | None = None,
    ) -> BlueprintResult:
        return self.agent_generator.generate_controlled_blueprint(payload, candidate_id=candidate_id)

    def generate_bundle(self, payload: BundleGenerationRequest) -> MatrixBundle:
        if not payload.persist and self.quota_service is not None:
            self.quota_service.consume_guest("guest")
        elif payload.persist and self.quota_service is not None:
            self.quota_service.consume_free(payload.account_id or "free-account")
        blueprint = self.agent_generator.generate_controlled_blueprint(
            payload.idea_request,
            candidate_id=payload.candidate_id,
        )
        bundle = self.agent_generator.generate_matrix_bundle(
            blueprint,
            preferred_coder=payload.preferred_coder,
        )
        # In sdk mode this is the engine's compiled, byte-for-byte content (== the CLI's bundle);
        # in mock mode it is None and the store renders a deterministic dev bundle.
        engine_files = self.agent_generator.compile_bundle_files(blueprint, payload.preferred_coder)
        assert self.bundle_store is not None
        return self.bundle_store.create_bundle(
            bundle,
            blueprint,
            preferred_coder=payload.preferred_coder,
            persist=payload.persist,
            owner_id=payload.account_id,
            engine_files=engine_files,
        )

    def get_bundle(self, bundle_id: str) -> MatrixBundle:
        assert self.bundle_store is not None
        return self.bundle_store.get_bundle(bundle_id) or get_mock_bundle(bundle_id=bundle_id)

    def get_bundle_manifest(self, bundle_id: str) -> BundleManifest | None:
        assert self.bundle_store is not None
        return self.bundle_store.get_manifest(bundle_id)

    def get_bundle_tree(self, bundle_id: str) -> list[BundleTreeNode]:
        assert self.bundle_store is not None
        tree = self.bundle_store.get_tree(bundle_id)
        return tree or self.get_bundle(bundle_id).tree

    def get_bundle_zip_path(self, bundle_id: str):
        assert self.bundle_store is not None
        return self.bundle_store.get_zip_path(bundle_id)

    def get_signed_bundle_url(self, bundle_id: str) -> SignedBundleUrlResponse:
        assert self.bundle_store is not None
        return self.bundle_store.signed_url(bundle_id)

    def save_bundle(self, bundle_id: str, payload: BundleSaveRequest) -> BundleSaveResponse:
        assert self.bundle_store is not None
        return self.bundle_store.save_bundle(bundle_id, payload)

    def cleanup_expired_bundles(self) -> BundleCleanupResponse:
        assert self.bundle_store is not None
        return self.bundle_store.cleanup_expired()

    def guest_quota(self) -> QuotaStatus:
        assert self.quota_service is not None
        return self.quota_service.check_guest("guest").status

    def get_prompt(
        self,
        bundle_id: str,
        coder: CoderId | str,
        bundle_url: str | None = None,
    ) -> PromptResponse:
        return self.agent_generator.generate_coder_prompt(bundle_id=bundle_id, coder=coder, bundle_url=bundle_url)

    def validate_bundle(
        self,
        bundle_id: str,
        payload: ValidationRequest | None = None,
    ) -> ValidationReport:
        bundle = self.get_bundle(bundle_id)
        # A submitted patch (changed files / dependency changes) gets the metadata contract check:
        # real findings, computed statelessly against the bundle's contract — no control-plane DB.
        # A bare bundle_id (no submitted changes) asks the engine to validate the bundle itself.
        has_changes = bool(payload and (payload.changed_files or payload.dependency_changes))
        if not has_changes and self.agent_generator.mode == "sdk":
            return self.agent_generator.validate_bundle(bundle_id)
        assert self.drift_detector is not None
        if payload and payload.bundle_id is None:
            payload.bundle_id = bundle_id
        return self.drift_detector.validate(bundle, payload)

    def publish_to_matrixhub(
        self,
        bundle_id: str,
        payload: PublicationRequest | None = None,
    ) -> PublicationResponse:
        bundle = self.get_bundle(bundle_id)
        validation = self.validate_bundle(bundle_id)
        assert self.matrixhub_client is not None
        return self.matrixhub_client.publish_bundle(bundle, validation, payload)

    def current_standards(self) -> StandardsStatus:
        return self.matrix_definitions.current()

    def runtime_status(self) -> dict[str, object]:
        return {
            "agent_generator": self.agent_generator.status(),
            "matrix_definitions": self.matrix_definitions.status(),
            "bundle_storage": self.bundle_store.storage.backend() if self.bundle_store else "unconfigured",
            "validation": "drift-detection-enabled",
            "matrixhub": self.matrixhub_client.status() if self.matrixhub_client else "unconfigured",
            "rule": "matrix-builder does orchestration; agent-generator does generation; matrix-definitions provides rules",
        }
