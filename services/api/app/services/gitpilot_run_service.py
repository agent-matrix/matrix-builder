from __future__ import annotations

import threading
import uuid
from typing import Any

import httpx

from app.core.config import Settings, get_settings
from app.schemas.gitpilot import (
    GitPilotCommitGate,
    GitPilotPrRequest,
    GitPilotPrResponse,
    GitPilotRepairRequest,
    GitPilotRunRequest,
    GitPilotRunResponse,
    GitPilotRunStatusResponse,
)
from app.services.gitpilot_run_store import get_run_store
from app.services.signed_url_service import SignedUrlService


class PrNotApprovedError(Exception):
    """Raised when a PR is requested for a run that Matrix has not approved.

    Opening a PR is Matrix authority: it requires an ``approved`` verdict on the
    run. GitPilot's own test pass is never sufficient.
    """


def commit_gate(status: object) -> GitPilotCommitGate:
    """Derive the commit gate from a Matrix ValidationStatus.

    The gate is a pure function of Matrix Builder's verdict — never of GitPilot's
    run state. ``approved`` unlocks the commit; ``needs-repair`` allows a repair;
    ``rejected`` blocks. Commit authority stays with Matrix Builder.
    """
    s = str(status)
    return GitPilotCommitGate(
        status=s,
        can_commit=s == "approved",
        can_repair=s == "needs-repair",
        blocked=s == "rejected",
    )


# Matrix control files GitPilot must never modify. GitPilot re-applies its own
# guardrails too; we send these as forbidden as defense in depth.
MATRIX_CONTROL_FILES = [
    "MATRIX_STANDARDS.lock",
    "MATRIX_BLUEPRINT.yaml",
    "MATRIX_TASKS.md",
    "MATRIX_ALLOWED_CHANGES.md",
    "MATRIX_ACCEPTANCE_CRITERIA.md",
    "MATRIX_VALIDATION.md",
]

# Mock-mode run registry (no network). Lets create_run -> get_run round-trip in
# tests/dev without a live GitPilot.
_MOCK_RUNS: dict[str, dict[str, Any]] = {}
_MOCK_LOCK = threading.Lock()

_STATUS_KEYS = ("run_id", "status", "summary", "test_status", "changed_files")


class GitPilotError(Exception):
    """Raised when the deployed GitPilot can't be reached or errors."""


class GitPilotRunService:
    """Server-side bridge to the deployed GitPilot.

    The signed bundle URL and the A2A secret are assembled here and sent to
    GitPilot server-to-server; neither ever reaches the browser. The browser
    only ever sees run ids, statuses, and Matrix-Builder-relative diff/logs URLs
    that we proxy.
    """

    def __init__(
        self,
        settings: Settings | None = None,
        signer: SignedUrlService | None = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.signer = signer or SignedUrlService()
        self.base_url = self.settings.gitpilot_base_url.rstrip("/")
        self.mode = (self.settings.gitpilot_mode or "mock").lower()

    # -- helpers -------------------------------------------------------------

    def _headers(self) -> dict[str, str]:
        headers = {"content-type": "application/json"}
        if self.settings.gitpilot_a2a_secret:
            headers["X-A2A-Secret"] = self.settings.gitpilot_a2a_secret
        return headers

    def _guard_live(self) -> None:
        """Fail closed: in production live mode the A2A secret is mandatory."""
        if (
            self.mode == "live"
            and self.settings.production
            and not self.settings.gitpilot_a2a_secret
        ):
            raise GitPilotError("GITPILOT_A2A_SECRET is required in production live mode")

    def _payload(self, bundle_id: str, request: GitPilotRunRequest) -> dict[str, Any]:
        # Short-TTL signed URL: GitPilot only needs it long enough to fetch the
        # bundle for this run, not the full bundle-download lifetime.
        signed = self.signer.sign_download_url(
            bundle_id, ttl_seconds=self.settings.gitpilot_run_ttl_seconds
        )
        forbidden = list(dict.fromkeys([*request.forbidden_files, *MATRIX_CONTROL_FILES]))
        return {
            "bundle_url": signed.url,
            "project_name": request.project_name,
            "task_id": request.task_id,
            "prompt": request.prompt,
            "allowed_files": list(request.allowed_files),
            "forbidden_files": forbidden,
            "validation_commands": list(request.validation_commands),
            "mode": request.mode,
        }

    @staticmethod
    def _mb_diff_url(run_id: str) -> str:
        return f"/api/v1/gitpilot/runs/{run_id}/diff"

    @staticmethod
    def _mb_logs_url(run_id: str) -> str:
        return f"/api/v1/gitpilot/runs/{run_id}/logs"

    # -- create --------------------------------------------------------------

    def create_run(self, bundle_id: str, request: GitPilotRunRequest) -> GitPilotRunResponse:
        payload = self._payload(bundle_id, request)
        if self.mode == "live":
            data = self._post("/api/v1/gitpilot/runs", payload)
            return GitPilotRunResponse(
                run_id=data["run_id"],
                status=data.get("status", "queued"),
                url=data.get("url", ""),
            )
        run_id = f"gp-run-{uuid.uuid4().hex[:12]}"
        with _MOCK_LOCK:
            _MOCK_RUNS[run_id] = {"task_id": request.task_id, "bundle_url": payload["bundle_url"]}
        return GitPilotRunResponse(
            run_id=run_id,
            status="queued",
            url=f"{self.base_url}/api/v1/gitpilot/runs/{run_id}",
        )

    # -- result sync ---------------------------------------------------------

    def get_run(self, run_id: str) -> GitPilotRunStatusResponse:
        if self.mode == "live":
            data = self._get(f"/api/v1/gitpilot/runs/{run_id}")
            picked = {k: data[k] for k in _STATUS_KEYS if k in data}
            # Re-point diff/logs at our own proxy so the browser never needs the
            # A2A secret. Only expose them when GitPilot has them.
            return GitPilotRunStatusResponse(
                **picked,
                diff_url=self._mb_diff_url(run_id) if data.get("diff_url") else None,
                logs_url=self._mb_logs_url(run_id) if data.get("logs_url") else None,
            )
        # mock — deterministic completed run.
        with _MOCK_LOCK:
            rec = _MOCK_RUNS.get(run_id)
        task_id = rec["task_id"] if rec else "TASK-001"
        return GitPilotRunStatusResponse(
            run_id=run_id,
            status="completed",
            summary=f"Implemented {task_id} (mock)",
            diff_url=self._mb_diff_url(run_id),
            logs_url=self._mb_logs_url(run_id),
            test_status="passed",
            changed_files=["tests/test_health.py"],
        )

    def repair_run(self, run_id: str, repair: GitPilotRepairRequest) -> GitPilotRunResponse:
        """Dispatch a repair task; GitPilot re-runs inside the same contract."""
        payload = {
            "validation_findings": list(repair.validation_findings),
            "repair_prompt": repair.repair_prompt,
            "allowed_files": list(repair.allowed_files),
            "forbidden_files": list(
                dict.fromkeys([*repair.forbidden_files, *MATRIX_CONTROL_FILES])
            ),
        }
        if self.mode == "live":
            data = self._post(f"/api/v1/gitpilot/runs/{run_id}/repair", payload)
            return GitPilotRunResponse(
                run_id=data["run_id"],
                status=data.get("status", "queued"),
                url=data.get("url", ""),
            )
        new_id = f"gp-run-{uuid.uuid4().hex[:12]}"
        with _MOCK_LOCK:
            parent = _MOCK_RUNS.get(run_id, {})
            _MOCK_RUNS[new_id] = {
                "task_id": parent.get("task_id", "TASK-001"),
                "bundle_url": parent.get("bundle_url", ""),
                "parent_run_id": run_id,
            }
        return GitPilotRunResponse(
            run_id=new_id,
            status="queued",
            url=f"{self.base_url}/api/v1/gitpilot/runs/{new_id}",
        )

    def create_pr(self, run_id: str, owner_id: str, pr: GitPilotPrRequest) -> GitPilotPrResponse:
        """Open a PR for an approved run — gated on the Matrix verdict.

        The run must carry an ``approved`` Matrix verdict (recorded at validation
        time). Opening a PR is Matrix authority, never GitPilot's own call.
        """
        record = get_run_store().get(run_id, owner_id)
        if record is None:
            raise PrNotApprovedError("Run not found.")
        if record.get("validation_status") != "approved":
            raise PrNotApprovedError(
                "Matrix approval required before opening a PR "
                f"(verdict: {record.get('validation_status') or 'not validated'})."
            )
        payload = {"repo_url": pr.repo_url, "title": pr.title, "base": pr.base}
        if self.mode == "live":
            data = self._post(f"/api/v1/gitpilot/runs/{run_id}/pr", payload)
            return GitPilotPrResponse(
                run_id=run_id,
                pr_url=data.get("pr_url"),
                status=data.get("status", "draft"),
                message=data.get("message", ""),
            )
        repo = (pr.repo_url or "https://github.com/owner/repo").rstrip("/")
        return GitPilotPrResponse(
            run_id=run_id,
            pr_url=f"{repo}/pull/draft-{run_id[-6:]}",
            status="draft",
            message="Draft PR (mock).",
        )

    def get_run_diff(self, run_id: str) -> str:
        if self.mode == "live":
            return self._get_text(f"/api/v1/gitpilot/runs/{run_id}/diff")
        return "--- a/tests/test_health.py\n+++ b/tests/test_health.py\n@@\n+def test_health():\n+    assert True\n"

    def get_run_logs(self, run_id: str) -> str:
        if self.mode == "live":
            return self._get_text(f"/api/v1/gitpilot/runs/{run_id}/logs")
        return "Dry-run: patch preview only. No PR opened, no changes pushed."

    # -- transport -----------------------------------------------------------

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        self._guard_live()
        try:
            resp = httpx.post(
                f"{self.base_url}{path}", json=payload, headers=self._headers(), timeout=20.0
            )
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as exc:
            raise GitPilotError(f"GitPilot request failed: {exc}") from exc

    def _get(self, path: str) -> dict[str, Any]:
        self._guard_live()
        try:
            resp = httpx.get(f"{self.base_url}{path}", headers=self._headers(), timeout=20.0)
            resp.raise_for_status()
            return resp.json()
        except httpx.HTTPError as exc:
            raise GitPilotError(f"GitPilot request failed: {exc}") from exc

    def _get_text(self, path: str) -> str:
        self._guard_live()
        try:
            resp = httpx.get(f"{self.base_url}{path}", headers=self._headers(), timeout=20.0)
            resp.raise_for_status()
            return resp.text
        except httpx.HTTPError as exc:
            raise GitPilotError(f"GitPilot request failed: {exc}") from exc
