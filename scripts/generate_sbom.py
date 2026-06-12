from __future__ import annotations
import json
from datetime import UTC, datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'releases'/'matrix-builder.sbom.cdx.json'
def pkg(path: Path) -> dict[str, object]:
    data=json.loads(path.read_text()); return {'type':'library','name':data.get('name',path.parent.name),'version':data.get('version','0.0.0')}
def main() -> None:
    components=[pkg(ROOT/r) for r in ['package.json','apps/web/package.json','packages/client-sdk/package.json','packages/ui/package.json'] if (ROOT/r).exists()]
    components.append({'type':'application','name':'matrix-builder-api','version':'0.9.0-batch.9'})
    sbom={'bomFormat':'CycloneDX','specVersion':'1.5','serialNumber':'urn:uuid:matrix-builder-batch9-development-sbom','version':1,'metadata':{'timestamp':datetime.now(UTC).isoformat(),'component':{'type':'application','name':'matrix-builder','version':'0.9.0-batch.9'}},'components':components}
    OUT.parent.mkdir(parents=True, exist_ok=True); OUT.write_text(json.dumps(sbom, indent=2, sort_keys=True)+'\n'); print(f'Wrote {OUT}')
if __name__=='__main__': main()
