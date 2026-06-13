"""Immutable object-storage key layout for the Continuous Build workflow (Batch C1).

Keys are deterministic and content-addressed by id, exactly as the design document specifies:

    projects/{project}/versions/{version}/bundle.zip
    projects/{project}/versions/{version}/batches/{batch}/prompts/{coder}.md
    projects/{project}/versions/{version}/commits/{commit}/manifest.json
    projects/{project}/versions/{version}/commits/{commit}/diff.patch
    projects/{project}/versions/{version}/commits/{commit}/validation/report.json
    projects/{project}/versions/{version}/commits/{commit}/validation/log.txt
    projects/{project}/versions/{version}/thumbnail.svg

These are bucket-relative keys (the bucket is ``settings.supabase_storage_bucket``); the same
strings work for Supabase Storage and the local/S3 backends.
"""

from __future__ import annotations


def version_prefix(project_id: str, version_id: str) -> str:
    return f"projects/{project_id}/versions/{version_id}"


def bundle_zip_key(project_id: str, version_id: str) -> str:
    return f"{version_prefix(project_id, version_id)}/bundle.zip"


def thumbnail_key(project_id: str, version_id: str) -> str:
    return f"{version_prefix(project_id, version_id)}/thumbnail.svg"


def thumbnail_status_key(project_id: str, version_id: str, status: str) -> str:
    # Status-scoped so each (project, version, status) thumbnail is write-once / immutable.
    return f"{version_prefix(project_id, version_id)}/thumbnails/{status}.svg"


def batch_prompt_key(project_id: str, version_id: str, batch_id: str, coder: str) -> str:
    return f"{version_prefix(project_id, version_id)}/batches/{batch_id}/prompts/{coder}.md"


def commit_prefix(project_id: str, version_id: str, commit_id: str) -> str:
    return f"{version_prefix(project_id, version_id)}/commits/{commit_id}"


def commit_manifest_key(project_id: str, version_id: str, commit_id: str) -> str:
    return f"{commit_prefix(project_id, version_id, commit_id)}/manifest.json"


def commit_diff_key(project_id: str, version_id: str, commit_id: str) -> str:
    return f"{commit_prefix(project_id, version_id, commit_id)}/diff.patch"


def commit_validation_report_key(project_id: str, version_id: str, commit_id: str) -> str:
    return f"{commit_prefix(project_id, version_id, commit_id)}/validation/report.json"


def commit_validation_log_key(project_id: str, version_id: str, commit_id: str) -> str:
    return f"{commit_prefix(project_id, version_id, commit_id)}/validation/log.txt"


# Run-scoped keys (Batch C3): a run produces evidence before a commit may exist.
def run_prefix(project_id: str, version_id: str, run_id: str) -> str:
    return f"{version_prefix(project_id, version_id)}/runs/{run_id}"


def run_report_key(project_id: str, version_id: str, run_id: str) -> str:
    return f"{run_prefix(project_id, version_id, run_id)}/validation/report.json"


def run_diff_key(project_id: str, version_id: str, run_id: str) -> str:
    return f"{run_prefix(project_id, version_id, run_id)}/diff.patch"


def run_log_key(project_id: str, version_id: str, run_id: str) -> str:
    return f"{run_prefix(project_id, version_id, run_id)}/validation/log.txt"


__all__ = [
    "version_prefix",
    "bundle_zip_key",
    "thumbnail_key",
    "thumbnail_status_key",
    "batch_prompt_key",
    "commit_prefix",
    "commit_manifest_key",
    "commit_diff_key",
    "commit_validation_report_key",
    "commit_validation_log_key",
    "run_prefix",
    "run_report_key",
    "run_diff_key",
    "run_log_key",
]
