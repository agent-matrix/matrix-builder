"""Branded landing page for the Matrix Builder control-plane API.

Served at ``/`` so the Hugging Face Space (and any direct backend host) shows a
real page — the API's "front face" — rather than a bare JSON. The full
interactive UI lives on Vercel (``builder.matrixhub.io``); this page links to it
and to the sibling services that make the ecosystem work end to end.
"""
from __future__ import annotations

# Scout design system palette (matrix-definitions / matrix-builder web).
_BG = "#02170f"
_GREEN = "#22c878"
_MINT = "#53f39d"

_LINKS = (
    ("Open the app", "https://builder.matrixhub.io", "The full Matrix Builder UI (Vercel)"),
    ("API docs", "/docs", "Interactive OpenAPI reference for this service"),
    ("Readiness", "/api/v1/ready", "Adapter + standards status JSON"),
    ("agent-generator", "https://ruslanmv-agent-generator.hf.space", "The deterministic generation engine"),
    ("GitPilot", "https://ruslanmv-gitpilot.hf.space", "A Matrix-native AI coder"),
    ("The standard", "https://www.matrixhub.io/definitions", "Signed Matrix Definitions"),
)


def landing_html(version: str) -> str:
    cards = "\n".join(
        f'<a class="card" href="{href}"><span class="t">{title}</span>'
        f'<span class="d">{desc}</span></a>'
        for title, href, desc in _LINKS
    )
    return f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Matrix Builder — control plane</title>
<style>
  :root {{ color-scheme: dark; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; background:{_BG}; color:#eafff4;
    font-family: ui-sans-serif, system-ui, "Hanken Grotesk", Inter, sans-serif;
    -webkit-font-smoothing:antialiased; min-height:100vh; display:flex; }}
  main {{ max-width:880px; margin:auto; padding:64px 28px; }}
  .badge {{ display:inline-flex; gap:8px; align-items:center; font-size:13px;
    color:{_MINT}; border:1px solid rgba(83,243,157,.3); border-radius:999px;
    padding:6px 14px; letter-spacing:.02em; }}
  .dot {{ width:8px; height:8px; border-radius:50%; background:{_GREEN};
    box-shadow:0 0 12px {_GREEN}; }}
  h1 {{ font-family: ui-serif, "Newsreader", Georgia, serif; font-weight:600;
    font-size:clamp(34px,6vw,56px); line-height:1.05; margin:22px 0 10px; }}
  h1 span {{ color:{_MINT}; }}
  p.lead {{ font-size:18px; color:#a7c9b8; max-width:620px; margin:0 0 8px; }}
  code {{ font-family: ui-monospace, "JetBrains Mono", monospace; color:{_MINT}; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
    gap:14px; margin-top:38px; }}
  .card {{ display:flex; flex-direction:column; gap:6px; text-decoration:none;
    color:inherit; background:rgba(34,200,120,.06); border:1px solid rgba(34,200,120,.18);
    border-radius:14px; padding:18px 18px; transition:.15s border-color,.15s background; }}
  .card:hover {{ border-color:{_GREEN}; background:rgba(34,200,120,.12); }}
  .card .t {{ font-weight:600; font-size:16px; color:{_MINT}; }}
  .card .d {{ font-size:13px; color:#9fc0af; }}
  footer {{ margin-top:44px; font-size:13px; color:#6f9482; }}
  footer a {{ color:{_MINT}; text-decoration:none; }}
</style></head>
<body><main>
  <span class="badge"><span class="dot"></span> control plane · live · v{version}</span>
  <h1>Give AI coders a<br><span>contract, not a prompt.</span></h1>
  <p class="lead">This is the <strong>Matrix Builder API</strong> — the control plane that turns
    one sentence into a signed, validated <strong>Matrix Bundle</strong> any AI coder can build
    inside. The full interactive experience runs at <code>builder.matrixhub.io</code>.</p>
  <p class="lead">Idea → <code>3 candidates</code> → Matrix Bundle → your AI coder builds under
    contract → <code>validated</code>.</p>
  <div class="grid">{cards}</div>
  <footer>Open source · MIT · part of the <strong>Matrix</strong> ecosystem ·
    built by <a href="https://ruslanmv.com">Ruslan Magana</a> ·
    <a href="https://github.com/sponsors/ruslanmv">Sponsor</a></footer>
</main></body></html>"""
