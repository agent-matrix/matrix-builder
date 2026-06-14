# Matrix Builder — introduction page

A single, self-contained premium landing page that introduces Matrix Builder to the world,
Apple-product simple: **`mb` is the Git, Matrix Builder is the GitHub** — version control and a
contract layer for AI-built software. Created by **Ruslan Magana Vsevolodovna**.

- One file, zero build step, no dependencies (fonts via Google Fonts CDN).
- Dark-emerald premium theme matching the product and the Definitions site.
- Reveal-on-scroll, fully responsive, respects `prefers-reduced-motion`.

## Preview locally

```bash
python3 -m http.server -d site 4321   # → http://localhost:4321
```

## Publish (pick one)

- **GitHub Pages** — set Pages to deploy from `/site` (or copy `site/index.html` to the Pages
  root / `docs/`). Suggested URL: `agent-matrix.github.io/matrix-builder`.
- **Vercel / Netlify / Cloudflare Pages** — point a static project at `site/`.
- **Custom domain** — e.g. `matrixbuilder.com` or `matrix.build` → this file.

## Edit

Everything is in `index.html` (markup + CSS + a tiny IntersectionObserver). Update the CTA URLs,
the creator links, and the copy in place — no toolchain required.
