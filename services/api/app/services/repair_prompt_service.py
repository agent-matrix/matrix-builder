from __future__ import annotations

from app.schemas.validation import ValidationViolation


def build_repair_prompt(bundle_id: str, violations: list[ValidationViolation]) -> str:
    """Create a bounded repair prompt for the selected AI coder."""
    lines = [
        "You are repairing a Matrix Builder controlled implementation.",
        "AI coders are workers, not architects.",
        "",
        f"Bundle ID: {bundle_id}",
        "",
        "Hard constraints:",
        "- Do not change MATRIX_BLUEPRINT.yaml.",
        "- Do not change MATRIX_STANDARDS.lock.",
        "- Do not add dependencies unless approval is explicitly granted.",
        "- Repair only the validation issues listed below.",
        "- Return a concise summary of files changed and commands run.",
        "",
        "Validation issues to repair:",
    ]
    for index, violation in enumerate(violations, start=1):
        path = f" at {violation.path}" if violation.path else ""
        remediation = f" Remediation: {violation.remediation}" if violation.remediation else ""
        lines.append(f"{index}. [{violation.severity}] {violation.rule_id}{path}: {violation.message}{remediation}")
    lines.extend(
        [
            "",
            "After the repair, run the commands from MATRIX_VALIDATION.md and report MATRIX_STATUS: ready-for-validation.",
        ]
    )
    return "\n".join(lines)
