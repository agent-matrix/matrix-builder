from pathlib import Path

def safe_zip_path(path: str) -> Path:
    candidate = Path(path)
    if candidate.is_absolute() or ".." in candidate.parts:
        raise ValueError("unsafe zip path")
    return candidate
