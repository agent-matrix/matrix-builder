from __future__ import annotations
import json, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
def test_security_scan_script_passes() -> None: subprocess.run([sys.executable,'scripts/security_scan.py'], cwd=ROOT, check=True)
def test_sbom_generation_creates_cyclonedx_file() -> None:
    subprocess.run([sys.executable,'scripts/generate_sbom.py'], cwd=ROOT, check=True); sbom=json.loads((ROOT/'releases/matrix-builder.sbom.cdx.json').read_text()); assert sbom['bomFormat']=='CycloneDX'; assert sbom['metadata']['component']['name']=='matrix-builder'
def test_checksum_generation_creates_release_file() -> None:
    subprocess.run([sys.executable,'scripts/generate_checksums.py'], cwd=ROOT, check=True); text=(ROOT/'releases/checksums.txt').read_text(); assert 'README.md' in text
