from pathlib import Path


def test_required_foundation_files_exist():
    required = [
        "README.md",
        "SECURITY.md",
        "CONTRIBUTING.md",
        "GOVERNANCE.md",
        "CODEOWNERS",
        "Makefile",
        "docker-compose.dev.yml",
        "services/api/app/main.py",
        "apps/web/src/app/matrix-builder/page.tsx",
    ]
    for item in required:
        assert Path(item).exists(), item
