"""Batch C4: seeded SVG thumbnails are deterministic, well-formed, and cover all five styles."""

from __future__ import annotations

from app.services.thumbnails import (
    murmur3_32,
    render_thumbnail,
    thumbnail_seed,
    thumbnail_style,
)

_STYLES = {"mesh", "wave", "spiral", "prism", "orb"}


def test_murmur3_empty_string_is_zero() -> None:
    # Canonical MurmurHash3 x86_32 vector: hash of "" with seed 0 is 0.
    assert murmur3_32("") == 0


def test_render_is_deterministic() -> None:
    a = render_thumbnail("proj-1", "ver-1", "approved")
    b = render_thumbnail("proj-1", "ver-1", "approved")
    assert a == b


def test_status_changes_the_thumbnail() -> None:
    approved = render_thumbnail("proj-1", "ver-1", "approved")
    rejected = render_thumbnail("proj-1", "ver-1", "rejected")
    assert approved != rejected  # different seed (status) and different accent


def test_svg_is_well_formed() -> None:
    svg = render_thumbnail("p", "v", "active")
    assert svg.startswith("<svg")
    assert 'viewBox="0 0 100 100"' in svg
    assert 'fill="#02170f"' in svg  # brand ground
    assert svg.rstrip().endswith("</svg>")


def test_all_five_styles_are_reachable() -> None:
    seen = set()
    for i in range(400):
        seed = thumbnail_seed("project", f"version-{i}", "active")
        seen.add(thumbnail_style(seed))
    assert seen == _STYLES


def test_style_is_embedded_for_introspection() -> None:
    seed = thumbnail_seed("proj", "ver", "approved")
    style = thumbnail_style(seed)
    svg = render_thumbnail("proj", "ver", "approved")
    assert f'data-style="{style}"' in svg
    assert 'data-status="approved"' in svg
