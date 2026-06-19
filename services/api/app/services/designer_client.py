"""Designer client — bridges Matrix Builder's control plane to Matrix Designer.

Resolution order (fail-open, never 500):
  1. HTTP service at ``MATRIX_DESIGNER_URL`` (the matrix-designer FastAPI service)
  2. the ``matrix_designer`` package if importable in-process
  3. a built-in deterministic fallback, so the Details page always has data even when
     the brain is unavailable or the Matrix Designer toggle is off.

All three return the same shape: ``{candidates, details, matrix_rules}`` where ``details``
maps candidate_id → a Blueprint Details dict (the page's dashboard data).
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

DESIGNER_URL = os.environ.get("MATRIX_DESIGNER_URL", "").rstrip("/")
RMD_RULES = [
    "RMD-101: AI coders are workers, not architects.",
    "RMD-103: Control files are protected.",
    "RMD-111: Acceptance criteria are law.",
]
_TIERS = [
    ("minimal", "Minimal", "Easy", "a weekend", 0.55, False),
    ("standard", "Standard", "Medium", "about one week", 1.0, True),
    ("production", "Production", "Hard", "about three weeks", 1.6, False),
]


class DesignerClient:
    def __init__(self, url: str = DESIGNER_URL) -> None:
        self.url = url

    # -- public API ---------------------------------------------------------------------
    def blueprints(self, idea: str, references=None, constraints=None) -> Dict[str, Any]:
        return self._call("/design/blueprints", {"idea": idea, "references": references, "constraints": constraints},
                          fallback=lambda: self._fallback_blueprints(idea))

    def details(self, idea: str, candidate_id: str) -> Dict[str, Any]:
        data = self.blueprints(idea)
        return data["details"].get(candidate_id) or data["details"].get("standard") or {}

    def refine(self, idea: str, message: str, candidate_id: str = "standard") -> Dict[str, Any]:
        return self._call("/design/refine", {"idea": idea, "message": message, "candidate_id": candidate_id},
                          fallback=lambda: self._fallback_refine(idea, message, candidate_id))

    # -- resolution ---------------------------------------------------------------------
    def _call(self, path: str, payload: Dict[str, Any], fallback) -> Dict[str, Any]:
        if self.url:
            try:
                import httpx  # local import keeps it optional
                r = httpx.post(f"{self.url}{path}", json=payload, timeout=8.0)
                if r.status_code == 200:
                    data = r.json()
                    if not data.get("error"):
                        return data
            except Exception:
                pass  # fall through to in-process / deterministic
        try:
            return self._via_import(path, payload)
        except Exception:
            return fallback()

    def _via_import(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        from matrix_designer.graph import design_blueprints, refine, run_design  # type: ignore
        if path.endswith("blueprints"):
            out = design_blueprints(payload["idea"], payload.get("references"), payload.get("constraints"))
            out.pop("_state", None)
            return out
        state = run_design(payload["idea"])
        out = refine(state, payload["message"], payload.get("candidate_id", "standard"))
        out.pop("_state", None)
        return out

    # -- deterministic fallback (self-contained) ---------------------------------------
    def _fallback_blueprints(self, idea: str) -> Dict[str, Any]:
        domain = self._domain(idea)
        stack = self._stack(domain)
        full = self._roadmap(domain)
        candidates: List[Dict[str, Any]] = []
        details: Dict[str, Any] = {}
        for cid, tier, diff, est, scale, rec in _TIERS:
            n = max(3, round(len(full) * scale))
            batches = full[:n] if n <= len(full) else full + self._extra(len(full), n - len(full))
            candidates.append({
                "id": cid, "tier": tier,
                "title": f"{tier} {'Matrix Bundle' if cid == 'standard' else 'controlled blueprint'}",
                "summary": f"{'Recommended ' if rec else ''}controlled blueprint for: {idea.strip()[:90]}",
                "file_count": max(8, round(len(self._files(domain)) * (2 + scale * 4))),
                "difficulty": diff, "estimate": est, "stack": stack, "recommended": rec,
            })
            details[cid] = {
                "candidate_id": cid,
                "overview": f"This {tier.lower()} blueprint builds {idea.strip()[:120]}. Delivered in ordered, validated batches.",
                "architecture": self._architecture(domain) if cid != "minimal" else self._architecture(domain)[:2],
                "batches": batches,
                "file_plan": self._files(domain),
                "matrix_rules": RMD_RULES,
                "acceptance_criteria": ["builds and runs", "core flow works with tests", "Matrix validation approves the build"],
                "validation_plan": ["lint", "typecheck", "unit tests", "allowed-file check", "Matrix commit check"],
                "risks": ["external credentials may be required"],
                "assumptions": ["original assets only" if domain == "web-game" else "auth required if data is sensitive"],
                "design_brain": f"Deterministic fallback · {len(batches)} batches · tier {tier}.",
                "chat_history": [],
            }
        return {"candidates": candidates, "details": details, "matrix_rules": RMD_RULES, "violations": []}

    def _fallback_refine(self, idea: str, message: str, candidate_id: str) -> Dict[str, Any]:
        data = self._fallback_blueprints(idea)
        det = data["details"].get(candidate_id, data["details"]["standard"])
        m = message.lower()
        if any(k in m for k in ("add", "boss", "level", "analytic", "audit", "auth", "dashboard")):
            nid = f"batch-{len(det['batches']) + 1:02d}"
            name = "Boss encounter" if "boss" in m else "Refinement"
            det["batches"].append({"id": nid, "name": name, "purpose": f"Added from chat: {message.strip()}",
                                   "tasks": [message.strip()], "allowed_files": ["src/**"], "depends_on": [],
                                   "acceptance_criteria": ["feature works", "no runtime errors"], "validation_checks": ["unit tests"], "must_not_change": []})
            reply = f"Added {nid} — {name}. Review and Save latest edits."
        elif any(k in m for k in ("reduce", "simpler", "remove", "drop")) and len(det["batches"]) > 3:
            dropped = det["batches"].pop()
            reply = f"Reduced scope — removed {dropped['name']}."
        else:
            reply = "Noted. Save latest edits to keep this."
        return {"reply": reply, "details": data["details"], "candidates": data["candidates"]}

    # -- tiny domain heuristics --------------------------------------------------------
    @staticmethod
    def _domain(idea: str) -> str:
        s = idea.lower()
        if any(k in s for k in ("game", "platformer", "phaser", "arcade")):
            return "web-game"
        if any(k in s for k in ("api", "fastapi", "service", "endpoint")):
            return "api"
        return "web-app"

    @staticmethod
    def _stack(domain: str) -> List[str]:
        return {"web-game": ["Phaser 3", "TypeScript", "Vite"], "api": ["FastAPI", "PostgreSQL", "Docker"]}.get(
            domain, ["Next.js", "FastAPI", "PostgreSQL", "Docker"])

    @staticmethod
    def _architecture(domain: str) -> List[Dict[str, Any]]:
        if domain == "web-game":
            return [{"name": "Web Client (Phaser)", "description": "Canvas game", "dependencies": []},
                    {"name": "Asset pipeline", "description": "Original art", "dependencies": ["Web Client (Phaser)"]},
                    {"name": "Level engine", "description": "Data-driven levels", "dependencies": ["Web Client (Phaser)"]},
                    {"name": "CI / Pages", "description": "Build + deploy", "dependencies": []}]
        return [{"name": "Web App", "description": "Frontend", "dependencies": []},
                {"name": "API", "description": "Business logic", "dependencies": ["Web App"]},
                {"name": "Database", "description": "Storage", "dependencies": ["API"]},
                {"name": "Worker / Queue", "description": "Background jobs", "dependencies": ["API"]},
                {"name": "Admin Dashboard", "description": "Ops & analytics", "dependencies": ["Web App", "API"]}]

    @staticmethod
    def _files(domain: str) -> List[Dict[str, str]]:
        if domain == "web-game":
            return [{"path": p, "description": d} for p, d in [
                ("src/scenes", "Boot/Preload/Game/…"), ("src/levels", "level data + builder"),
                ("src/entities", "Player, enemies, Coin"), ("public/assets", "original art"), ("README.md", "overview")]]
        return [{"path": p, "description": d} for p, d in [
            ("apps/web", "Web app and dashboard"), ("services/api", "API and business logic"),
            ("services/worker", "Background jobs"), ("packages/shared", "Shared types"), ("db", "Migrations"), ("README.md", "overview")]]

    @staticmethod
    def _roadmap(domain: str) -> List[Dict[str, Any]]:
        if domain == "web-game":
            spec = [("Game foundation", ["vite.config.ts", "src/main.ts"]), ("Asset pipeline", ["scripts/gen_assets.py", "public/assets/**"]),
                    ("Tilemap world", ["src/levels/**"]), ("Player & controls", ["src/entities/Player.ts"]),
                    ("Enemies & power-ups", ["src/entities/**"]), ("HUD & gate", ["src/ui/HUD.ts"]),
                    ("Campaign & boss", ["src/levels/episodes.ts"]), ("Polish & release", [".github/workflows/deploy.yml"])]
        else:
            spec = [("Foundation", ["apps/web/**", "services/api/**"]), ("Integrations", ["services/api/**"]),
                    ("Workflow & logic", ["services/api/**"]), ("Admin & analytics", ["apps/web/**"]),
                    ("Hardening & deploy", ["docker-compose.yml", ".github/**"]), ("Validation & release", ["tests/**"])]
        out = []
        for i, (name, allowed) in enumerate(spec, 1):
            out.append({"id": f"batch-{i:02d}", "name": name, "purpose": f"{name}.", "tasks": [name],
                        "allowed_files": allowed, "depends_on": [f"batch-{i-1:02d}"] if i > 1 else [],
                        "acceptance_criteria": ["builds", "feature works", "no runtime errors"],
                        "validation_checks": ["lint", "typecheck", "tests"], "must_not_change": []})
        return out

    @staticmethod
    def _extra(start: int, count: int) -> List[Dict[str, Any]]:
        names = ["Observability", "Performance pass", "Security review", "Docs & onboarding", "Accessibility"]
        out = []
        for k in range(count):
            i = start + k + 1
            out.append({"id": f"batch-{i:02d}", "name": names[k % len(names)], "purpose": "Production hardening.",
                        "tasks": ["hardening"], "allowed_files": ["**"], "depends_on": [f"batch-{i-1:02d}"],
                        "acceptance_criteria": ["meets the production bar"], "validation_checks": ["tests"], "must_not_change": []})
        return out


def get_designer_client() -> DesignerClient:
    return DesignerClient()
