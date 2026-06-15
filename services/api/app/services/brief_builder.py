"""Deterministic ProjectBrief builder — markdown → structured brief, no AI.

Heuristics over the extracted markdown: title from the first heading, summary from the first
paragraph, goals/features from bullet sections. Reproducible and dependency-free. OllaBridge may
later enrich the result for logged-in users, but this baseline must always work offline.
"""
from __future__ import annotations

import re
from pathlib import PurePosixPath

from app.schemas.brief import BriefSource, ProjectBrief

_BULLET = re.compile(r"^\s*[-*+]\s+(.*\S)\s*$")
_HEADING = re.compile(r"^\s*#{1,6}\s+(.*\S)\s*$")
_GOAL_WORDS = ("goal", "objective", "outcome")
_FEATURE_WORDS = ("feature", "requirement", "scope", "capabilit", "deliverable")
_NFR_WORDS = ("non-functional", "nonfunctional", "quality", "security", "performance", "compliance")


def _stem(filename: str) -> str:
    stem = PurePosixPath(filename or "").stem.replace("-", " ").replace("_", " ").strip()
    return stem[:120] or "Imported project"


def _first_heading_or_line(lines: list[str]) -> str | None:
    for ln in lines:
        m = _HEADING.match(ln)
        if m:
            return m.group(1).strip()
    for ln in lines:
        if ln.strip():
            return ln.strip()
    return None


def _first_paragraph(lines: list[str], skip: str | None) -> str | None:
    for ln in lines:
        s = ln.strip()
        if not s or _HEADING.match(ln) or _BULLET.match(ln):
            continue
        if skip and s == skip:
            continue
        return s
    return None


def _all_bullets(lines: list[str]) -> list[str]:
    out: list[str] = []
    for ln in lines:
        m = _BULLET.match(ln)
        if m:
            out.append(m.group(1).strip())
    return out


def _section_bullets(lines: list[str], words: tuple[str, ...]) -> list[str]:
    """Bullets that appear under a heading containing one of `words`, until the next heading."""
    out: list[str] = []
    in_section = False
    for ln in lines:
        h = _HEADING.match(ln)
        if h:
            in_section = any(w in h.group(1).lower() for w in words)
            continue
        if in_section:
            m = _BULLET.match(ln)
            if m:
                out.append(m.group(1).strip())
    return out


def _dedupe(items: list[str], limit: int) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for it in items:
        key = it.lower()
        if it and key not in seen:
            seen.add(key)
            out.append(it[:160])
        if len(out) >= limit:
            break
    return out


def build_brief(markdown: str, filename: str, source_type: BriefSource = "document") -> ProjectBrief:
    lines = (markdown or "").splitlines()
    title = (_first_heading_or_line(lines) or _stem(filename))[:120]
    summary = (_first_paragraph(lines, skip=title) or title)[:400]

    goals = _section_bullets(lines, _GOAL_WORDS)
    nfr = _section_bullets(lines, _NFR_WORDS)
    features = _section_bullets(lines, _FEATURE_WORDS)
    if not features:
        # fall back to all bullets that aren't already goals/NFRs
        taken = {b.lower() for b in goals + nfr}
        features = [b for b in _all_bullets(lines) if b.lower() not in taken]

    return ProjectBrief(
        source_type=source_type,
        title=title,
        summary=summary,
        goals=_dedupe(goals, 8),
        features=_dedupe(features, 12),
        non_functional=_dedupe(nfr, 8),
        source_files=[filename] if filename else [],
        enhanced_by="deterministic",
    )


def brief_to_idea(brief: ProjectBrief) -> str:
    """Fold the brief into a single idea string the deterministic engine can parse (Path B)."""
    parts: list[str] = [brief.title.strip()]
    summary = brief.summary.strip()
    if summary and summary != brief.title.strip():
        parts.append(summary)
    if brief.features:
        parts.append("Key features: " + ", ".join(brief.features[:6]))
    if brief.goals:
        parts.append("Goals: " + ", ".join(brief.goals[:4]))
    idea = ". ".join(p for p in parts if p)
    # IdeaRequest allows 5..4000 chars; keep a safe margin.
    return idea[:3900] if len(idea) >= 5 else (brief.title or "Imported project")[:3900]
