from __future__ import annotations
import hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'releases'/'checksums.txt'; SKIP={'.git','.pytest_cache','.mypy_cache','.ruff_cache','node_modules','.local'}
def digest(path: Path) -> str:
    h=hashlib.sha256()
    with path.open('rb') as f:
        for c in iter(lambda:f.read(1024*1024), b''): h.update(c)
    return h.hexdigest()
def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True); lines=[]
    for p in sorted(ROOT.rglob('*')):
        if p.is_file() and not any(part in SKIP for part in p.parts) and str(p.relative_to(ROOT))!='releases/checksums.txt': lines.append(f'{digest(p)}  {p.relative_to(ROOT).as_posix()}')
    OUT.write_text('\n'.join(lines)+'\n'); print(f'Wrote {OUT} with {len(lines)} entries')
if __name__=='__main__': main()
