#!/usr/bin/env python3
"""High-quality screenshots of the Matrix Builder web app (Playwright Chromium).

Captures crisp, retina-scale shots of the landing page and the controlled-build flow
(hero → blueprint candidates → Matrix Bundle) for the README, docs, and marketing.

Usage:
    python -m pip install playwright && python -m playwright install chromium
    cd apps/web && pnpm dev   # or: pnpm build && pnpm start  (serves http://localhost:3000)
    python apps/web/scripts/shoot.py --base-url http://localhost:3000 --out docs/assets/screenshots

Keep Playwright transient: `python -m pip uninstall -y playwright` after capture.
"""

from __future__ import annotations

import argparse
import asyncio
from pathlib import Path

from playwright.async_api import TimeoutError as PWTimeout
from playwright.async_api import async_playwright

# Static routes worth documenting. The C4 work pages (/builder/*) require an authenticated
# session, so the marketing sequence below drives the public /matrix-builder flow instead.
ROUTES = [
    ("home", "/"),
    ("matrix-builder", "/matrix-builder"),
    ("examples", "/examples"),
    ("docs", "/docs"),
]


async def settle(page, ms: int = 900):
    await page.wait_for_timeout(ms)


async def shot(page, out: Path, name: str, full: bool = False):
    await settle(page)
    p = out / f"{name}.png"
    await page.screenshot(path=str(p), full_page=full)
    print(f"shot: {p}")


async def capture_routes(page, base: str, out: Path):
    for name, route in ROUTES:
        try:
            await page.goto(f"{base}{route}", wait_until="networkidle")
            await shot(page, out, name)
        except Exception as exc:  # noqa: BLE001
            print(f"skipped {name}: {exc}")


async def capture_builder_flow(page, base: str, out: Path):
    """Drive the controlled-build flow for the marketing sequence (best-effort, defensive)."""
    try:
        await page.goto(f"{base}/matrix-builder", wait_until="networkidle")
        await shot(page, out, "01-hero")

        # Type an idea and generate blueprint candidates.
        try:
            box = page.locator('input[aria-label="Describe your idea"], .l-idea input').first
            await box.fill("A GitHub repo intelligence agent", timeout=4000)
        except PWTimeout:
            pass
        await page.get_by_text("Generate blueprint", exact=False).first.click(timeout=5000)
        await settle(page, 2600)  # let the scanning phase finish
        await shot(page, out, "02-candidates")

        # Choose the recommended candidate → the Matrix Bundle.
        try:
            await page.get_by_text("Choose this", exact=False).first.click(timeout=5000)
            await settle(page, 1400)
            await shot(page, out, "03-bundle")
        except Exception as exc:  # noqa: BLE001
            print(f"skipped bundle: {exc}")
    except Exception as exc:  # noqa: BLE001
        print(f"skipped builder-flow: {exc}")


async def main():
    ap = argparse.ArgumentParser(description="Screenshot the Matrix Builder web app.")
    ap.add_argument("--base-url", default="http://localhost:3000")
    ap.add_argument("--out", default="docs/assets/screenshots")
    ap.add_argument("--width", type=int, default=1440)
    ap.add_argument("--height", type=int, default=900)
    ap.add_argument("--scale", type=int, default=2, help="Device scale (2 = retina).")
    ap.add_argument("--light", action="store_true", help="Light color scheme (default: dark).")
    args = ap.parse_args()

    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(
            viewport={"width": args.width, "height": args.height},
            device_scale_factor=args.scale,
            color_scheme="light" if args.light else "dark",
        )
        page = await ctx.new_page()
        await capture_builder_flow(page, args.base_url, out)
        await capture_routes(page, args.base_url, out)
        await browser.close()
    print("done")


if __name__ == "__main__":
    asyncio.run(main())
