from __future__ import annotations

import json
import shutil
import zipfile
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Iterable

from app.core.config import get_settings
from app.integrations.object_storage import ObjectStorage
from app.schemas.blueprint import BlueprintResult
from app.schemas.bundle import (
    BundleCleanupResponse,
    BundleGenerationRequest,
    BundleManifest,
    BundleSaveRequest,
    BundleSaveResponse,
    BundleStatus,
    BundleTreeNode,
    MatrixBundle,
    SignedBundleUrlResponse,
)
from app.schemas.common import BundleFile, CoderId, ValidationStatus
from app.services.signed_url_service import SignedUrlService
from app.services.ai_coder_prompt_service import build_prompt_content, build_prompt_pack
from app.storage.bundle_paths import bundle_dir, content_dir, index_path, manifest_path, zip_path
from app.utils.hashing import sha256_bytes, sha256_text
from app.utils.time import utc_now

CONTROL_FILES = [
    ("README.md", "doc", "text/markdown"),
    ("MATRIX_BLUEPRINT.yaml", "control", "application/yaml"),
    ("MATRIX_STANDARDS.lock", "control", "application/yaml"),
    ("MATRIX_TASKS.md", "control", "text/markdown"),
    ("MATRIX_ALLOWED_CHANGES.md", "control", "text/markdown"),
    ("MATRIX_ACCEPTANCE_CRITERIA.md", "control", "text/markdown"),
    ("MATRIX_VALIDATION.md", "control", "text/markdown"),
    ("docs/architecture.md", "doc", "text/markdown"),
    ("docs/security.md", "doc", "text/markdown"),
    ("docs/standards-report.md", "doc", "text/markdown"),
    ("coder-prompts/claude-code.md", "prompt", "text/markdown"),
    ("coder-prompts/codex-chatgpt.md", "prompt", "text/markdown"),
    ("coder-prompts/cursor.md", "prompt", "text/markdown"),
    ("coder-prompts/ibm-bob.md", "prompt", "text/markdown"),
    ("coder-prompts/gitpilot.md", "prompt", "text/markdown"),
    ("coder-prompts/generic-ai-coder.md", "prompt", "text/markdown"),
    ("coder-prompts/prompt-pack.json", "prompt", "application/json"),
    ("artifacts/manifest.json", "manifest", "application/json"),
    ("artifacts/checksums.txt", "artifact", "text/plain"),
]


@dataclass
class StoredBundle:
    bundle: MatrixBundle
    manifest: BundleManifest
    zip_file: Path


class BundleStore:
    """Local Matrix Bundle storage service.

    This is the production boundary for Bundle artifacts. It writes the same objects that
    a future S3/MinIO implementation will store: bundle content, manifest, checksums, and ZIP.
    """

    def __init__(self, storage: ObjectStorage | None = None) -> None:
        self.storage = storage or ObjectStorage()
        self.settings = get_settings()
        self.signer = SignedUrlService()

    def create_bundle(
        self,
        bundle: MatrixBundle,
        blueprint: BlueprintResult,
        preferred_coder: CoderId,
        persist: bool = False,
        owner_id: str | None = None,
    ) -> MatrixBundle:
        now = utc_now()
        ttl = self.settings.free_bundle_ttl_seconds if persist else self.settings.guest_bundle_ttl_seconds
        expires_at = now + timedelta(seconds=ttl)
        files_content = self._render_bundle_files(bundle, blueprint, preferred_coder)
        content_root = content_dir(bundle.bundle_id)
        if content_root.exists():
            shutil.rmtree(content_root)
        content_root.mkdir(parents=True, exist_ok=True)

        file_records: list[BundleFile] = []
        checksums: dict[str, str] = {}
        for rel_path, content in sorted(files_content.items()):
            path = content_root / rel_path
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            digest = sha256_bytes(content)
            checksums[rel_path] = digest
            kind, content_type = _file_meta(rel_path)
            file_records.append(
                BundleFile(
                    path=rel_path,
                    kind=kind,
                    required=True,
                    content_type=content_type,
                    digest=digest,
                    size_bytes=len(content),
                )
            )

        checksums_text = "\n".join(f"{digest}  {path}" for path, digest in sorted(checksums.items())) + "\n"
        (content_root / "artifacts" / "checksums.txt").write_text(checksums_text, encoding="utf-8")
        checksums["artifacts/checksums.txt"] = sha256_text(checksums_text)
        _upsert_file_record(file_records, "artifacts/checksums.txt", "artifact", "text/plain", checksums_text.encode("utf-8"))

        zip_file = zip_path(bundle.bundle_id)
        self._write_zip(content_root, zip_file)
        zip_bytes = zip_file.read_bytes()
        zip_digest = sha256_bytes(zip_bytes)
        storage_uri = f"local://bundles/{bundle.bundle_id}/{bundle.bundle_id}.zip"
        signed = self.signer.sign_download_url(bundle.bundle_id, ttl_seconds=self.settings.signed_url_ttl_seconds)

        manifest_seed = {
            "bundle_id": bundle.bundle_id,
            "blueprint_id": bundle.blueprint_id,
            "file_digests": checksums,
            "zip_digest": zip_digest,
            "standards": bundle.standards,
        }
        manifest_digest = sha256_text(json.dumps(manifest_seed, sort_keys=True))
        manifest = BundleManifest(
            bundle_id=bundle.bundle_id,
            blueprint_id=bundle.blueprint_id,
            title=bundle.title,
            created_at=now,
            expires_at=expires_at,
            status=BundleStatus.SAVED if persist else BundleStatus.READY,
            manifest_digest=manifest_digest,
            zip_digest=zip_digest,
            zip_size_bytes=len(zip_bytes),
            file_count=len(file_records),
            files=file_records,
            prompts_available=list(CoderId),
            standards=bundle.standards,
            storage_uri=storage_uri,
            checksums=checksums,
            metadata={
                "owner_id": owner_id,
                "persisted": persist,
                "preferred_coder": preferred_coder,
                "engine": "agent-generator",
                "rule": "matrix-builder orchestrates; agent-generator generates; matrix-definitions provides rules",
            },
        )
        manifest_json = manifest.model_dump_json(indent=2)
        manifest_path(bundle.bundle_id).write_text(manifest_json, encoding="utf-8")
        (content_root / "artifacts" / "manifest.json").write_text(manifest_json, encoding="utf-8")

        bundle.created_at = now
        bundle.expires_at = expires_at
        bundle.status = BundleStatus.SAVED if persist else BundleStatus.READY
        bundle.expires_in_seconds = ttl
        bundle.files = file_records
        bundle.tree = [
            BundleTreeNode(
                path=file.path,
                kind=file.kind,
                required=file.required,
                size_bytes=file.size_bytes,
                digest=file.digest,
            )
            for file in file_records
        ]
        bundle.file_count = len(file_records)
        bundle.zip_digest = zip_digest
        bundle.zip_size_bytes = len(zip_bytes)
        bundle.manifest_digest = manifest_digest
        bundle.storage_uri = storage_uri
        bundle.persisted = persist
        bundle.owner_id = owner_id
        bundle.signed_download_url = signed.url
        bundle.bundle_url = f"/api/v1/bundles/{bundle.bundle_id}"
        bundle.download_url = f"/api/v1/bundles/{bundle.bundle_id}/download"
        bundle.manifest_url = f"/api/v1/bundles/{bundle.bundle_id}/manifest"
        bundle.links.update(
            {
                "self": bundle.bundle_url,
                "download": bundle.download_url,
                "signed_download": signed.url,
                "manifest": bundle.manifest_url,
                "tree": f"/api/v1/bundles/{bundle.bundle_id}/tree",
                "save": f"/api/v1/bundles/{bundle.bundle_id}/save",
            }
        )
        self._write_index(bundle)
        return bundle

    def get_bundle(self, bundle_id: str) -> MatrixBundle | None:
        manifest = self.get_manifest(bundle_id)
        if manifest is None:
            return None
        now = utc_now()
        status = manifest.status
        if manifest.expires_at and manifest.expires_at < now and status != BundleStatus.SAVED:
            status = BundleStatus.EXPIRED
        signed = self.signer.sign_download_url(bundle_id)
        return MatrixBundle(
            bundle_id=manifest.bundle_id,
            blueprint_id=manifest.blueprint_id,
            title=manifest.title,
            status=status,
            created_at=manifest.created_at,
            expires_at=manifest.expires_at,
            bundle_url=f"/api/v1/bundles/{bundle_id}",
            download_url=f"/api/v1/bundles/{bundle_id}/download",
            signed_download_url=signed.url,
            manifest_url=f"/api/v1/bundles/{bundle_id}/manifest",
            manifest_digest=manifest.manifest_digest,
            zip_digest=manifest.zip_digest,
            zip_size_bytes=manifest.zip_size_bytes,
            file_count=manifest.file_count,
            expires_in_seconds=max(int((manifest.expires_at - now).total_seconds()), 0) if manifest.expires_at else 0,
            persisted=bool(manifest.metadata.get("persisted")),
            owner_id=manifest.metadata.get("owner_id") if isinstance(manifest.metadata.get("owner_id"), str) else None,
            storage_uri=manifest.storage_uri,
            files=manifest.files,
            tree=[BundleTreeNode(path=f.path, kind=f.kind, required=f.required, size_bytes=f.size_bytes, digest=f.digest) for f in manifest.files],
            prompts_available=manifest.prompts_available,
            standards=manifest.standards,
            validation=ValidationStatus.NOT_RUN,
            links={
                "self": f"/api/v1/bundles/{bundle_id}",
                "download": f"/api/v1/bundles/{bundle_id}/download",
                "signed_download": signed.url,
                "manifest": f"/api/v1/bundles/{bundle_id}/manifest",
                "tree": f"/api/v1/bundles/{bundle_id}/tree",
            },
        )

    def get_manifest(self, bundle_id: str) -> BundleManifest | None:
        path = manifest_path(bundle_id)
        if not path.exists():
            return None
        return BundleManifest.model_validate_json(path.read_text(encoding="utf-8"))

    def get_zip_path(self, bundle_id: str) -> Path | None:
        path = zip_path(bundle_id)
        return path if path.exists() else None

    def get_tree(self, bundle_id: str) -> list[BundleTreeNode]:
        bundle = self.get_bundle(bundle_id)
        return bundle.tree if bundle else []

    def signed_url(self, bundle_id: str) -> SignedBundleUrlResponse:
        signed = self.signer.sign_download_url(bundle_id)
        return SignedBundleUrlResponse(
            bundle_id=bundle_id,
            url=signed.url,
            expires_at=signed.expires_at,
            expires_in_seconds=signed.expires_in_seconds,
        )

    def save_bundle(self, bundle_id: str, payload: BundleSaveRequest) -> BundleSaveResponse:
        manifest = self.get_manifest(bundle_id)
        if manifest is None:
            raise FileNotFoundError(bundle_id)
        manifest.status = BundleStatus.SAVED
        manifest.expires_at = utc_now() + timedelta(seconds=self.settings.free_bundle_ttl_seconds)
        manifest.metadata["persisted"] = True
        manifest.metadata["owner_id"] = payload.account_id or payload.account_email or "free-account"
        manifest.metadata["label"] = payload.label
        manifest_path(bundle_id).write_text(manifest.model_dump_json(indent=2), encoding="utf-8")
        bundle = self.get_bundle(bundle_id)
        if bundle is not None:
            self._write_index(bundle)
        return BundleSaveResponse(
            bundle_id=bundle_id,
            saved=True,
            status=BundleStatus.SAVED,
            expires_at=manifest.expires_at,
            message="Bundle saved to the free-account retention policy.",
        )

    def cleanup_expired(self) -> BundleCleanupResponse:
        deleted: list[str] = []
        now = utc_now()
        index = self._read_index()
        for bundle_id in list(index):
            manifest = self.get_manifest(bundle_id)
            if manifest is None:
                index.pop(bundle_id, None)
                continue
            if manifest.status == BundleStatus.SAVED:
                continue
            if manifest.expires_at and manifest.expires_at < now:
                shutil.rmtree(bundle_dir(bundle_id), ignore_errors=True)
                deleted.append(bundle_id)
                index.pop(bundle_id, None)
        self._write_index_raw(index)
        return BundleCleanupResponse(deleted_count=len(deleted), deleted_bundle_ids=deleted)

    def _render_bundle_files(
        self,
        bundle: MatrixBundle,
        blueprint: BlueprintResult,
        preferred_coder: CoderId,
    ) -> dict[str, bytes]:
        prompt_files = {
            "claude-code": self._prompt("claude-code", bundle.bundle_id),
            "codex-chatgpt": self._prompt("codex-chatgpt", bundle.bundle_id),
            "cursor": self._prompt("cursor", bundle.bundle_id),
            "ibm-bob": self._prompt("ibm-bob", bundle.bundle_id),
            "gitpilot": self._prompt("gitpilot", bundle.bundle_id),
            "generic-ai-coder": self._prompt("generic-ai-coder", bundle.bundle_id),
        }
        files: dict[str, str] = {
            "README.md": f"""# {blueprint.name}\n\nThis is a Matrix Builder controlled project bundle.\n\nThe AI coder is the implementation worker, not the architect. Follow the Matrix control files before editing code.\n\nPreferred coder: `{preferred_coder}`\n\n## Build contract\n\n- `MATRIX_BLUEPRINT.yaml` defines the architecture.\n- `MATRIX_STANDARDS.lock` pins standards from matrix-definitions.\n- `MATRIX_ALLOWED_CHANGES.md` defines what the AI coder may edit.\n- `MATRIX_VALIDATION.md` defines local checks.\n""",
            "MATRIX_BLUEPRINT.yaml": _blueprint_yaml(blueprint),
            "MATRIX_STANDARDS.lock": _standards_lock(blueprint),
            "MATRIX_TASKS.md": _tasks_md(blueprint),
            "MATRIX_ALLOWED_CHANGES.md": _allowed_changes_md(blueprint),
            "MATRIX_ACCEPTANCE_CRITERIA.md": _acceptance_md(blueprint),
            "MATRIX_VALIDATION.md": _validation_md(blueprint),
            "docs/architecture.md": _architecture_md(blueprint),
            "docs/security.md": _security_md(blueprint),
            "docs/standards-report.md": _standards_report_md(bundle, blueprint),
            **{f"coder-prompts/{coder}.md": text for coder, text in prompt_files.items()},
            "coder-prompts/prompt-pack.json": build_prompt_pack(
                bundle_id=bundle.bundle_id,
                blueprint_id=blueprint.blueprint_id,
                default_coder=preferred_coder,
                bundle_url=f"/api/v1/bundles/{bundle.bundle_id}",
            ).model_dump_json(indent=2),
            "artifacts/manifest.json": "{}\n",
            "artifacts/checksums.txt": "",
        }
        return {path: content.encode("utf-8") for path, content in files.items()}

    def _prompt(self, coder: str, bundle_id: str) -> str:
        return build_prompt_content(
            bundle_id=bundle_id,
            coder=coder,
            bundle_url=f"/api/v1/bundles/{bundle_id}",
        )

    def _write_zip(self, content_root: Path, zip_file: Path) -> None:
        zip_file.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(zip_file, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(content_root.rglob("*")):
                if path.is_file():
                    archive.write(path, arcname=path.relative_to(content_root))

    def _write_index(self, bundle: MatrixBundle) -> None:
        index = self._read_index()
        index[bundle.bundle_id] = {
            "bundle_id": bundle.bundle_id,
            "title": bundle.title,
            "status": str(bundle.status),
            "created_at": bundle.created_at.isoformat() if bundle.created_at else None,
            "expires_at": bundle.expires_at.isoformat() if bundle.expires_at else None,
            "download_url": bundle.download_url,
        }
        self._write_index_raw(index)

    def _read_index(self) -> dict[str, dict[str, object]]:
        path = index_path()
        if not path.exists():
            return {}
        return json.loads(path.read_text(encoding="utf-8"))

    def _write_index_raw(self, index: dict[str, dict[str, object]]) -> None:
        path = index_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(index, indent=2, sort_keys=True), encoding="utf-8")


def generate_bundle(payload: BundleGenerationRequest) -> MatrixBundle:
    from app.dependencies import get_matrix_builder_service

    return get_matrix_builder_service().generate_bundle(payload)


def get_bundle_store() -> BundleStore:
    return BundleStore()


def get_mock_bundle(bundle_id: str = "bundle_demo_standard") -> MatrixBundle:
    now = utc_now()
    files = [BundleFile(path=path, kind=kind, required=True, content_type=content_type) for path, kind, content_type in CONTROL_FILES]
    return MatrixBundle(
        bundle_id=bundle_id,
        blueprint_id="bp_demo_standard",
        title="Standard Matrix Bundle",
        status=BundleStatus.READY,
        created_at=now,
        expires_at=now + timedelta(seconds=get_settings().guest_bundle_ttl_seconds),
        bundle_url=f"/api/v1/bundles/{bundle_id}",
        download_url=f"/api/v1/bundles/{bundle_id}/download",
        manifest_url=f"/api/v1/bundles/{bundle_id}/manifest",
        manifest_digest=sha256_text(bundle_id),
        file_count=len(files),
        files=files,
        tree=[BundleTreeNode(path=f.path, kind=f.kind, required=f.required, size_bytes=f.size_bytes, digest=f.digest) for f in files],
        prompts_available=list(CoderId),
        standards=["RMD-001", "RMD-002", "RMD-003", "GHA-001", "AGENT-001"],
        validation=ValidationStatus.NOT_RUN,
        links={"self": f"/api/v1/bundles/{bundle_id}", "download": f"/api/v1/bundles/{bundle_id}/download"},
    )


def _file_meta(path: str) -> tuple[str, str]:
    for candidate_path, kind, content_type in CONTROL_FILES:
        if path == candidate_path:
            return kind, content_type
    if path.startswith("coder-prompts/"):
        return "prompt", "text/markdown"
    if path.startswith("docs/"):
        return "doc", "text/markdown"
    if path.startswith("artifacts/"):
        return "artifact", "application/json" if path.endswith(".json") else "text/plain"
    return "source", "text/plain"


def _upsert_file_record(records: list[BundleFile], path: str, kind: str, content_type: str, content: bytes) -> None:
    digest = sha256_bytes(content)
    for index, record in enumerate(records):
        if record.path == path:
            records[index] = BundleFile(path=path, kind=kind, required=True, content_type=content_type, digest=digest, size_bytes=len(content))
            return
    records.append(BundleFile(path=path, kind=kind, required=True, content_type=content_type, digest=digest, size_bytes=len(content)))


def _yaml_list(items: Iterable[str], indent: int = 2) -> str:
    prefix = " " * indent
    return "\n".join(f"{prefix}- {item}" for item in items)


def _blueprint_yaml(blueprint: BlueprintResult) -> str:
    routes = "\n".join(f"  - method: {route.method}\n    path: {route.path}\n    summary: {route.summary or ''}" for route in blueprint.api_routes)
    return f"""schema_version: 1\nblueprint_id: {blueprint.blueprint_id}\nname: {blueprint.name}\nslug: {blueprint.slug}\nidea: {blueprint.idea}\nquality_level: {blueprint.quality_level}\nstack:\n  frontend: {blueprint.stack.frontend}\n  backend: {blueprint.stack.backend}\n  worker: {blueprint.stack.worker}\n  database: {blueprint.stack.database}\n  auth: {blueprint.stack.auth}\npages:\n{_yaml_list(blueprint.pages)}\nservices:\n{_yaml_list(blueprint.services)}\napi_routes:\n{routes}\nrequired_files:\n{_yaml_list(blueprint.required_files)}\nallowed_change_roots:\n{_yaml_list(blueprint.allowed_change_roots)}\nforbidden_changes:\n{_yaml_list(blueprint.forbidden_changes)}\n"""


def _standards_lock(blueprint: BlueprintResult) -> str:
    return f"""schema_version: 1\nlock_id: lock_{blueprint.blueprint_id}\nengine:\n  name: agent-generator\n  version: mock-boundary\nblueprint:\n  blueprint_id: {blueprint.blueprint_id}\n  digest: {sha256_text(blueprint.blueprint_id)}\nstandards:\n  matrix_definitions_pack: current\n  ruslan_magana_definitions: current\nrules_applied:\n  - RMD-001\n  - RMD-002\n  - RMD-003\n  - RMD-107\n  - AGENT-001\n  - GHA-001\nexceptions: []\n"""


def _tasks_md(blueprint: BlueprintResult) -> str:
    lines = ["# Matrix Tasks", "", "Implement one task at a time. Do not act as architect.", ""]
    for task in blueprint.tasks:
        lines.extend([f"## {task.task_id}: {task.title}", "", "Allowed files:"])
        lines.extend(f"- `{path}`" for path in task.allowed_files)
        lines.extend(["", "Acceptance criteria:"])
        lines.extend(f"- {criterion}" for criterion in task.acceptance_criteria)
        lines.append("")
    return "\n".join(lines)


def _allowed_changes_md(blueprint: BlueprintResult) -> str:
    return "# Matrix Allowed Changes\n\nAllowed roots:\n" + "\n".join(f"- `{root}`" for root in blueprint.allowed_change_roots) + "\n\nForbidden changes:\n" + "\n".join(f"- `{path}`" for path in blueprint.forbidden_changes) + "\n"


def _acceptance_md(blueprint: BlueprintResult) -> str:
    return "# Matrix Acceptance Criteria\n\nValidation commands must pass before the AI coder finishes.\n\n" + "\n".join(f"- `{cmd}`" for cmd in blueprint.acceptance_commands) + "\n"


def _validation_md(blueprint: BlueprintResult) -> str:
    return "# Matrix Validation\n\nRun these commands before returning the implementation.\n\n" + "\n".join(f"```bash\n{cmd}\n```" for cmd in blueprint.acceptance_commands) + "\n"


def _architecture_md(blueprint: BlueprintResult) -> str:
    return f"# Architecture\n\nBlueprint `{blueprint.blueprint_id}` uses {blueprint.stack.frontend}, {blueprint.stack.backend}, and {blueprint.stack.database}. Matrix Builder preserves this architecture through locked control files.\n"


def _security_md(blueprint: BlueprintResult) -> str:
    return f"# Security\n\nThis project follows Matrix Builder control rules. AI coders may not modify `MATRIX_BLUEPRINT.yaml`, `MATRIX_STANDARDS.lock`, dependencies, or workflow files unless a Matrix exception exists.\n\nStandards lock: `{blueprint.standards_lock_ref}`\n"


def _standards_report_md(bundle: MatrixBundle, blueprint: BlueprintResult) -> str:
    return "# Standards Report\n\nRules applied to this Matrix Bundle:\n\n" + "\n".join(f"- {rule}" for rule in bundle.standards) + f"\n\nBlueprint: `{blueprint.blueprint_id}`\n"
