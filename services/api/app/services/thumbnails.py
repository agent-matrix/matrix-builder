"""Seeded SVG thumbnails for versions (Batch C4).

A version's thumbnail is fully deterministic: ``murmur3(project:version:status)`` seeds both the
style choice (mesh / wave / spiral / prism / orb) and the geometry, so the same project+version+
status always renders the identical SVG. That determinism is what lets the thumbnail be stored
once as an *immutable* artifact and served byte-for-byte forever after.

The palette is the Matrix Builder brand language: ``#02170f`` ground with green accents, tinted
by the version's status (approved = bright green, needs-repair = amber, rejected = red, otherwise
the calm default).
"""

from __future__ import annotations

import math

_STYLES = ("mesh", "wave", "spiral", "prism", "orb")

# Status -> (primary accent, secondary accent). Verbatim engine statuses + a couple of UI states.
_ACCENTS: dict[str, tuple[str, str]] = {
    "approved": ("#53f39d", "#22c878"),
    "needs-repair": ("#f4b740", "#c98a12"),
    "rejected": ("#ff6b6b", "#c2433f"),
    "running": ("#7ad7ff", "#3aa0d8"),
    "not-run": ("#53f39d", "#22c878"),
    "active": ("#53f39d", "#22c878"),
}
_GROUND = "#02170f"
_RING = "rgba(34,200,120,.4)"


def murmur3_32(key: str, seed: int = 0) -> int:
    """MurmurHash3 x86_32 — small, fast, well-distributed; used purely as a deterministic seed."""
    data = key.encode("utf-8")
    length = len(data)
    h = seed & 0xFFFFFFFF
    c1, c2 = 0xCC9E2D51, 0x1B873593
    rounded = (length // 4) * 4
    for i in range(0, rounded, 4):
        k = data[i] | (data[i + 1] << 8) | (data[i + 2] << 16) | (data[i + 3] << 24)
        k = (k * c1) & 0xFFFFFFFF
        k = ((k << 15) | (k >> 17)) & 0xFFFFFFFF
        k = (k * c2) & 0xFFFFFFFF
        h ^= k
        h = ((h << 13) | (h >> 19)) & 0xFFFFFFFF
        h = (h * 5 + 0xE6546B64) & 0xFFFFFFFF
    k = 0
    rem = length & 3
    if rem == 3:
        k ^= data[rounded + 2] << 16
    if rem >= 2:
        k ^= data[rounded + 1] << 8
    if rem >= 1:
        k ^= data[rounded]
        k = (k * c1) & 0xFFFFFFFF
        k = ((k << 15) | (k >> 17)) & 0xFFFFFFFF
        k = (k * c2) & 0xFFFFFFFF
        h ^= k
    h ^= length
    h ^= h >> 16
    h = (h * 0x85EBCA6B) & 0xFFFFFFFF
    h ^= h >> 13
    h = (h * 0xC2B2AE35) & 0xFFFFFFFF
    h ^= h >> 16
    return h & 0xFFFFFFFF


class _Rng:
    """Deterministic xorshift32 stream seeded from the murmur hash."""

    def __init__(self, seed: int) -> None:
        self.s = (seed & 0xFFFFFFFF) or 0x9E3779B9

    def _next(self) -> int:
        x = self.s
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        self.s = x & 0xFFFFFFFF
        return self.s

    def unit(self) -> float:
        return self._next() / 0xFFFFFFFF

    def between(self, lo: float, hi: float) -> float:
        return lo + self.unit() * (hi - lo)


def _f(value: float) -> str:
    return f"{value:.1f}".rstrip("0").rstrip(".")


def thumbnail_seed(project_id: str, version_id: str, status: str) -> int:
    return murmur3_32(f"{project_id}:{version_id}:{status}")


def thumbnail_style(seed: int) -> str:
    return _STYLES[seed % len(_STYLES)]


def render_thumbnail(project_id: str, version_id: str, status: str = "active") -> str:
    """Return the deterministic SVG (100x100) for this project+version+status."""
    seed = thumbnail_seed(project_id, version_id, status)
    style = thumbnail_style(seed)
    primary, secondary = _ACCENTS.get(status, _ACCENTS["active"])
    rng = _Rng(seed)
    body = _RENDERERS[style](rng, primary, secondary)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" '
        f'data-style="{style}" data-status="{status}">'
        f'<rect width="100" height="100" fill="{_GROUND}"/>'
        f"{body}</svg>"
    )


# --- per-style renderers -------------------------------------------------------------------


def _mesh(rng: _Rng, primary: str, secondary: str) -> str:
    n = 7 + int(rng.between(0, 4))
    pts = [(rng.between(14, 86), rng.between(14, 86)) for _ in range(n)]
    parts: list[str] = []
    for i, (x1, y1) in enumerate(pts):
        for x2, y2 in pts[i + 1 :]:
            if math.hypot(x1 - x2, y1 - y2) < 34:
                parts.append(
                    f'<line x1="{_f(x1)}" y1="{_f(y1)}" x2="{_f(x2)}" y2="{_f(y2)}" '
                    f'stroke="{secondary}" stroke-width="1" opacity=".5"/>'
                )
    for x, y in pts:
        parts.append(f'<circle cx="{_f(x)}" cy="{_f(y)}" r="3" fill="{primary}"/>')
    return "".join(parts)


def _wave(rng: _Rng, primary: str, secondary: str) -> str:
    parts: list[str] = []
    rows = 3
    for row in range(rows):
        amp = rng.between(7, 13)
        phase = rng.between(0, math.pi * 2)
        base = 28 + row * 22
        d = [f"M0 {_f(base)}"]
        for x in range(0, 101, 10):
            y = base + amp * math.sin(phase + x / 14.0)
            d.append(f"L{x} {_f(y)}")
        color = primary if row == 1 else secondary
        parts.append(
            f'<path d="{" ".join(d)}" fill="none" stroke="{color}" '
            f'stroke-width="{_f(rng.between(1.4, 2.4))}" opacity=".75"/>'
        )
    return "".join(parts)


def _spiral(rng: _Rng, primary: str, secondary: str) -> str:
    turns = rng.between(2.4, 3.6)
    steps = 90
    growth = rng.between(4.6, 5.6)
    pts: list[str] = []
    for i in range(steps + 1):
        t = (i / steps) * turns * math.pi * 2
        r = growth * t / (math.pi * 2) * (38 / (growth * turns))
        x = 50 + r * math.cos(t)
        y = 50 + r * math.sin(t)
        pts.append(f"{_f(x)} {_f(y)}")
    return (
        f'<polyline points="{" ".join(pts)}" fill="none" stroke="{secondary}" '
        f'stroke-width="1.6" opacity=".7"/>'
        f'<circle cx="50" cy="50" r="4" fill="{primary}"/>'
    )


def _prism(rng: _Rng, primary: str, secondary: str) -> str:
    parts: list[str] = []
    rings = 4
    rot = rng.between(0, math.pi / 3)
    for k in range(rings):
        radius = 12 + k * 9
        sides = 3 + k % 3
        verts = []
        for s in range(sides):
            a = rot + s * (math.pi * 2 / sides) + k * 0.3
            verts.append(f"{_f(50 + radius * math.cos(a))} {_f(50 + radius * math.sin(a))}")
        color = primary if k == rings - 1 else secondary
        parts.append(
            f'<polygon points="{" ".join(verts)}" fill="none" stroke="{color}" '
            f'stroke-width="1.3" opacity="{_f(0.4 + k * 0.14)}"/>'
        )
    parts.append(f'<circle cx="50" cy="50" r="2.6" fill="{primary}"/>')
    return "".join(parts)


def _orb(rng: _Rng, primary: str, secondary: str) -> str:
    parts = [f'<circle cx="50" cy="50" r="30" fill="none" stroke="{_RING}" stroke-width="2"/>']
    nodes = 5 + int(rng.between(0, 3))
    start = rng.between(0, math.pi * 2)
    ring = []
    coords = []
    for i in range(nodes):
        a = start + i * (math.pi * 2 / nodes)
        x, y = 50 + 22 * math.cos(a), 50 + 22 * math.sin(a)
        coords.append((x, y))
        ring.append(f"{_f(x)} {_f(y)}")
        parts.append(f'<circle cx="{_f(x)}" cy="{_f(y)}" r="3.4" fill="{primary}"/>')
    parts.insert(
        1,
        f'<polygon points="{" ".join(ring)}" fill="none" stroke="{primary}" '
        f'stroke-width="1.4" opacity=".55"/>',
    )
    parts.append(f'<circle cx="50" cy="50" r="5" fill="{secondary}"/>')
    return "".join(parts)


_RENDERERS = {
    "mesh": _mesh,
    "wave": _wave,
    "spiral": _spiral,
    "prism": _prism,
    "orb": _orb,
}


__all__ = [
    "murmur3_32",
    "thumbnail_seed",
    "thumbnail_style",
    "render_thumbnail",
]
