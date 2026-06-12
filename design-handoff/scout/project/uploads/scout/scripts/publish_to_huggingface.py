#!/usr/bin/env python
import os
from pathlib import Path
from huggingface_hub import HfApi, upload_folder

repo_id = os.getenv("HF_DATASET_REPO", "ruslanmv/scout-data")
token = os.getenv("HF_TOKEN")
folder = Path("datasets")
if not token:
    raise SystemExit("HF_TOKEN is required")
api = HfApi(token=token)
api.create_repo(repo_id=repo_id, repo_type="dataset", exist_ok=True)
upload_folder(repo_id=repo_id, repo_type="dataset", folder_path=str(folder), token=token)
print(f"Published {folder} to {repo_id}")
