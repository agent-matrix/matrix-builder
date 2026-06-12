from __future__ import annotations

from dataclasses import dataclass

from app.schemas.bundle import MatrixBundle
from app.schemas.common import BundleFile, ValidationStatus
from app.schemas.validation import (
    DependencyChange,
    ValidationCheck,
    ValidationReport,
    ValidationRequest,
    ValidationViolation,
)
from app.services.repair_prompt_service import build_repair_prompt
from app.utils.ids import stable_id
from app.utils.time import utc_now

CONTROL_FILES = {
    "MATRIX_BLUEPRINT.yaml",
    "MATRIX_STANDARDS.lock",
    "MATRIX_TASKS.md",
    "MATRIX_ALLOWED_CHANGES.md",
    "MATRIX_ACCEPTANCE_CRITERIA.md",
    "MATRIX_VALIDATION.md",
}
FORBIDDEN_PREFIXES = (".github/workflows/", "deploy/helm/", "artifacts/attestations/")
REQUIRED_ARTIFACTS = {
    "README.md",
    "MATRIX_BLUEPRINT.yaml",
    "MATRIX_STANDARDS.lock",
    "docs/standards-report.md",
    "artifacts/manifest.json",
    "artifacts/checksums.txt",
}


@dataclass(frozen=True)
class DriftDetectionAdapter:
    """Policy adapter for validating AI-coder output against a Matrix Bundle.

    The real production path can delegate to agent-generator. This local implementation is
    intentionally deterministic so Matrix Builder can say approved / needs-repair / rejected
    during development and CI.
    """

    def validate(self, bundle: MatrixBundle, request: ValidationRequest | None = None) -> ValidationReport:
        payload = request or ValidationRequest(bundle_id=bundle.bundle_id, mode="bundle")
        changed_paths = [item.path for item in payload.changed_files]
        violations: list[ValidationViolation] = []
        checks: list[ValidationCheck] = []

        self._check_required_files(bundle.files, violations, checks)
        self._check_forbidden_file_changes(changed_paths, violations, checks)
        self._check_dependency_drift(payload.dependency_changes, violations, checks)
        self._check_standards_lock(bundle, payload, changed_paths, violations, checks)
        self._check_release_artifacts(bundle.files, violations, checks)

        status = _status_from(violations)
        score = _score_from(violations)
        repair_prompt = build_repair_prompt(bundle.bundle_id, violations) if violations else None
        approved = status == ValidationStatus.APPROVED
        return ValidationReport(
            report_id=stable_id("val", f"{bundle.bundle_id}:{score}:{len(violations)}"),
            bundle_id=bundle.bundle_id,
            status=status,
            score=score,
            violations=violations,
            repair_prompt=repair_prompt,
            checks=checks,
            approved=approved,
            matrixhub_publishable=approved,
            summary=_summary_for(status, violations),
            created_at=utc_now(),
        )

    def _check_required_files(
        self,
        files: list[BundleFile],
        violations: list[ValidationViolation],
        checks: list[ValidationCheck],
    ) -> None:
        present = {file.path for file in files}
        missing = sorted(REQUIRED_ARTIFACTS - present)
        if missing:
            for path in missing:
                violations.append(
                    ValidationViolation(
                        rule_id="RMD-009",
                        severity="high",
                        path=path,
                        message="Required Matrix Bundle artifact is missing.",
                        remediation="Regenerate the Matrix Bundle with agent-generator and keep all required artifacts.",
                    )
                )
            checks.append(
                ValidationCheck(
                    check_id="required_artifacts_present",
                    status="failed",
                    message=", ".join(missing),
                )
            )
        else:
            checks.append(
                ValidationCheck(
                    check_id="required_artifacts_present",
                    status="passed",
                    message="All Matrix control and trust artifacts are present.",
                )
            )

    def _check_forbidden_file_changes(
        self,
        changed_paths: list[str],
        violations: list[ValidationViolation],
        checks: list[ValidationCheck],
    ) -> None:
        bad_paths = [path for path in changed_paths if path in CONTROL_FILES or path.startswith(FORBIDDEN_PREFIXES)]
        if bad_paths:
            for path in bad_paths:
                rule_id = "RMD-103" if path in CONTROL_FILES else "RMD-002"
                violations.append(
                    ValidationViolation(
                        rule_id=rule_id,
                        severity="critical",
                        path=path,
                        message="AI coder changed a forbidden Matrix-controlled file or protected path.",
                        remediation="Restore this file from the original Matrix Bundle. AI coders are workers, not architects.",
                    )
                )
            checks.append(
                ValidationCheck(
                    check_id="forbidden_file_changes_absent",
                    status="failed",
                    message=", ".join(bad_paths),
                )
            )
        else:
            checks.append(
                ValidationCheck(
                    check_id="forbidden_file_changes_absent",
                    status="passed",
                    message="No forbidden Matrix control file changes were detected.",
                )
            )

    def _check_dependency_drift(
        self,
        dependency_changes: list[DependencyChange],
        violations: list[ValidationViolation],
        checks: list[ValidationCheck],
    ) -> None:
        unapproved = [change for change in dependency_changes if not change.approved]
        if unapproved:
            for change in unapproved:
                package = f"{change.ecosystem}:{change.name}"
                violations.append(
                    ValidationViolation(
                        rule_id="RMD-105",
                        severity="high",
                        path=package,
                        message=f"Unapproved dependency {change.action}: {package}.",
                        remediation="Request explicit approval or remove the dependency change.",
                    )
                )
            checks.append(
                ValidationCheck(
                    check_id="dependency_drift_absent",
                    status="failed",
                    message=", ".join(f"{item.ecosystem}:{item.name}" for item in unapproved),
                )
            )
        else:
            checks.append(
                ValidationCheck(
                    check_id="dependency_drift_absent",
                    status="passed",
                    message="No unapproved dependency changes were detected.",
                )
            )

    def _check_standards_lock(
        self,
        bundle: MatrixBundle,
        payload: ValidationRequest,
        changed_paths: list[str],
        violations: list[ValidationViolation],
        checks: list[ValidationCheck],
    ) -> None:
        if "MATRIX_STANDARDS.lock" in changed_paths:
            checks.append(
                ValidationCheck(
                    check_id="standards_lock_unchanged",
                    status="failed",
                    message="MATRIX_STANDARDS.lock changed after bundle approval.",
                )
            )
            return
        if payload.standards_lock_digest and bundle.manifest_digest:
            if payload.standards_lock_digest != bundle.manifest_digest:
                violations.append(
                    ValidationViolation(
                        rule_id="RMD-002",
                        severity="critical",
                        path="MATRIX_STANDARDS.lock",
                        message="Submitted standards lock digest does not match the generated Matrix Bundle digest.",
                        remediation="Use the original standards lock from the bundle or regenerate the bundle.",
                    )
                )
                checks.append(
                    ValidationCheck(
                        check_id="standards_lock_digest_matches",
                        status="failed",
                        message="Digest mismatch.",
                    )
                )
                return
            checks.append(
                ValidationCheck(
                    check_id="standards_lock_digest_matches",
                    status="passed",
                    message="Standards lock digest matches the Matrix Bundle record.",
                )
            )
            return
        checks.append(
            ValidationCheck(
                check_id="standards_lock_digest_matches",
                status="skipped",
                message="No standards lock digest was provided; forbidden-change policy still applies.",
            )
        )

    def _check_release_artifacts(
        self,
        files: list[BundleFile],
        violations: list[ValidationViolation],
        checks: list[ValidationCheck],
    ) -> None:
        present = {file.path for file in files}
        missing_trust_files = sorted({"artifacts/manifest.json", "artifacts/checksums.txt"} - present)
        if missing_trust_files:
            violations.append(
                ValidationViolation(
                    rule_id="REL-001",
                    severity="medium",
                    path="artifacts/",
                    message="Bundle is missing trust artifacts required for MatrixHub publication.",
                    remediation="Regenerate the Matrix Bundle so manifest and checksums are included.",
                )
            )
            checks.append(
                ValidationCheck(
                    check_id="trust_artifacts_present",
                    status="failed",
                    message=", ".join(missing_trust_files),
                )
            )
        else:
            checks.append(
                ValidationCheck(
                    check_id="trust_artifacts_present",
                    status="passed",
                    message="Manifest and checksums are present.",
                )
            )


def _status_from(violations: list[ValidationViolation]) -> ValidationStatus:
    severities = {violation.severity for violation in violations}
    if "critical" in severities:
        return ValidationStatus.REJECTED
    if severities:
        return ValidationStatus.NEEDS_REPAIR
    return ValidationStatus.APPROVED


def _score_from(violations: list[ValidationViolation]) -> int:
    weights = {"critical": 35, "high": 20, "medium": 10, "low": 5, "info": 1}
    penalty = sum(weights.get(violation.severity, 1) for violation in violations)
    return max(0, 100 - penalty)


def _summary_for(status: ValidationStatus, violations: list[ValidationViolation]) -> str:
    if status == ValidationStatus.APPROVED:
        return "Approved: the AI-coder output stayed inside the Matrix contract."
    if status == ValidationStatus.REJECTED:
        return "Rejected: critical Matrix contract drift was detected."
    return f"Needs repair: {len(violations)} validation issue(s) must be fixed before approval."
