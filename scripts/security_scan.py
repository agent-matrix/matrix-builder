from __future__ import annotations
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REQUIRED=['SECURITY.md','CODEOWNERS','.github/workflows/security-scan.yml','services/api/app/core/security_headers.py','services/api/app/core/rate_limits.py','services/api/app/core/session.py']
DOCKER={'services/api/Dockerfile':['USER matrixbuilder','HEALTHCHECK'],'workers/Dockerfile':['USER matrixbuilder']}
def main() -> None:
    missing=[p for p in REQUIRED if not (ROOT/p).exists()]
    if missing: raise SystemExit('Missing security files:\n'+'\n'.join(missing))
    for rel,tokens in DOCKER.items():
        text=(ROOT/rel).read_text(); miss=[t for t in tokens if t not in text]
        if miss: raise SystemExit(f'{rel} is missing: {miss}')
    print('Security baseline scan passed.')
if __name__=='__main__': main()
