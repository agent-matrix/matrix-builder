/* global React, ReactDOM */
const { useState: uS, useEffect: uE, useRef: uR } = React;
const MX = window.MATRIX;

/* ---------- icons ---------- */
function MIc({ d, size = 22, sw = 1.7 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
}
const I = {
  search: <React.Fragment><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.2-3.2" /></React.Fragment>,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  spark: <path d="M13 2.5L4.5 14H10l-1 7.5L17.5 10H12l1-7.5z" />,
  layers: <React.Fragment><path d="M12 3.5l8.5 4.7L12 12.9 3.5 8.2 12 3.5z" /><path d="M3.5 13l8.5 4.7L20.5 13" /></React.Fragment>,
  git: <React.Fragment><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="9" r="2.5" /><path d="M6 8.5v7M16 10.5c-3 1.5-7 .5-9 4" /></React.Fragment>,
  doc: <React.Fragment><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4" /></React.Fragment>,
  check: <React.Fragment><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.3l2.4 2.4 4.6-5" /></React.Fragment>,
  cube: <React.Fragment><path d="M12 2.7l8 4.6v9.4l-8 4.6-8-4.6V7.3z" /><path d="M4 7.3l8 4.7 8-4.7M12 12v8.6" /></React.Fragment>,
  shield: <React.Fragment><path d="M12 2.5l7 3v5.5c0 4.3-2.9 7.4-7 9-4.1-1.6-7-4.7-7-9V5.5z" /><path d="M9 12l2 2 4-4.2" /></React.Fragment>,
  copy: <React.Fragment><rect x="8.5" y="8.5" width="11" height="11" rx="2.2" /><path d="M5.5 15.5H5a1.5 1.5 0 01-1.5-1.5V5A1.5 1.5 0 015 3.5h9A1.5 1.5 0 0115.5 5v.5" /></React.Fragment>,
  download: <React.Fragment><path d="M12 3v12M7 10.5l5 5 5-5" /><path d="M4.5 20.5h15" /></React.Fragment>,
  send: <React.Fragment><path d="M21 3L10.5 13.5" /><path d="M21 3l-6.5 18-4-8.5L2 8.5 21 3z" /></React.Fragment>,
  code: <React.Fragment><path d="M8.5 7.5L4 12l4.5 4.5" /><path d="M15.5 7.5L20 12l-4.5 4.5" /></React.Fragment>,
  person: <React.Fragment><circle cx="12" cy="8" r="3.5" /><path d="M5 19.5c1.5-3.6 4-5.2 7-5.2s5.5 1.6 7 5.2" /></React.Fragment>,
  pin: <React.Fragment><path d="M12 21.5S5 15 5 10a7 7 0 0114 0c0 5-7 11.5-7 11.5z" /><circle cx="12" cy="10" r="2.5" /></React.Fragment>,
  plug: <React.Fragment><path d="M9 7.5V3.5M15 7.5V3.5" /><path d="M7 7.5h10v3.5a5 5 0 01-10 0V7.5z" /><path d="M12 16v4.5" /></React.Fragment>,
  db: <React.Fragment><ellipse cx="12" cy="5.5" rx="7" ry="2.6" /><path d="M5 5.5V18c0 1.45 3.1 2.6 7 2.6s7-1.15 7-2.6V5.5" /><path d="M5 11.8c0 1.45 3.1 2.6 7 2.6s7-1.15 7-2.6" /></React.Fragment>,
  back: <path d="M14 6l-6 6 6 6" />
};

/* ---------- rotating node-network sphere (canvas) ---------- */
function MNetwork() {
  const ref = uR(null);
  uE(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0, W = 0, H = 0;
    const fit = () => { const r = canvas.parentElement.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = Math.max(1, W * dpr); canvas.height = Math.max(1, H * dpr); };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(canvas.parentElement);

    // fibonacci sphere nodes
    const N = 116, GA = Math.PI * (3 - Math.sqrt(5));
    const nodes = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * GA;
      nodes.push([Math.cos(th) * r, y, Math.sin(th) * r]);
    }
    // edges between near neighbours
    const edges = [];
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const d = nodes[i][0] * nodes[j][0] + nodes[i][1] * nodes[j][1] + nodes[i][2] * nodes[j][2];
      if (d > 0.86) edges.push([i, j]);
    }
    const pulses = [];
    for (let k = 0; k < 7 && k < edges.length; k++) pulses.push({ e: (k * 13) % edges.length, t: Math.random() });
    const hubs = [4, 22, 51, 78, 99].filter(i => i < N);

    const TILT = 0.5, ct = Math.cos(TILT), st = Math.sin(TILT);
    let t0 = -1;
    const draw = (t) => {
      if (t0 < 0) t0 = t;
      const spin = reduced ? 0.6 : 0.6 + (t - t0) * 0.00009;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const R = W * 0.4, cx = W * 0.66, cy = H * 0.62;
      const cs = Math.cos(spin), sn = Math.sin(spin);
      const proj = nodes.map(([x, y, z]) => {
        const rx = x * cs + z * sn, rz = -x * sn + z * cs;
        const ry = y * ct - rz * st, rz2 = y * st + rz * ct;
        return [cx + rx * R, cy - ry * R, rz2];
      });
      // halo
      let g = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.25);
      g.addColorStop(0, "rgba(34,200,120,.12)"); g.addColorStop(1, "rgba(34,200,120,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.25, 0, 7); ctx.fill();
      // edges
      for (let k = 0; k < edges.length; k++) {
        const a = proj[edges[k][0]], b = proj[edges[k][1]];
        const depth = (a[2] + b[2]) / 2;
        ctx.strokeStyle = "rgba(83,243,157," + (0.05 + (depth + 1) * 0.07).toFixed(3) + ")";
        ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      // pulses travelling along edges
      pulses.forEach(p => {
        if (!reduced) p.t += 0.006; if (p.t > 1) { p.t = 0; p.e = (p.e + 7) % edges.length; }
        const a = proj[edges[p.e][0]], b = proj[edges[p.e][1]];
        const x = a[0] + (b[0] - a[0]) * p.t, y = a[1] + (b[1] - a[1]) * p.t;
        const gg = ctx.createRadialGradient(x, y, 0, x, y, 5);
        gg.addColorStop(0, "rgba(125,255,181,.9)"); gg.addColorStop(1, "rgba(125,255,181,0)");
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
      });
      // nodes
      for (let i = 0; i < N; i++) {
        const [x, y, z] = proj[i]; const fr = (z + 1) / 2;
        ctx.fillStyle = "rgba(83,243,157," + (0.18 + fr * 0.55).toFixed(3) + ")";
        const s = 1 + fr * 1.8; ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
      }
      // glowing hubs
      hubs.forEach((i, k) => {
        const [x, y, z] = proj[i]; if (z < -0.1) return;
        const pulse = reduced ? 1 : 0.7 + 0.3 * Math.sin(t / 600 + k * 1.6);
        const gg = ctx.createRadialGradient(x, y, 0, x, y, 10 * pulse);
        gg.addColorStop(0, "rgba(83,243,157,.7)"); gg.addColorStop(1, "rgba(83,243,157,0)");
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, 10 * pulse, 0, 7); ctx.fill();
        ctx.fillStyle = "#7dffb5"; ctx.beginPath(); ctx.arc(x, y, 2.3, 0, 7); ctx.fill();
      });
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw(performance.now());
    return () => { cancelAnimationFrame(raf); if (ro) ro.disconnect(); };
  }, []);
  return <canvas className="lc-globe-canvas" ref={ref} aria-hidden="true" />;
}

/* ---------- carousel ---------- */
const SLIDES = [
  { title: "Describe your idea", render: () => (
    <React.Fragment>
      <div className="lc-trend t1"><span className="lc-ic"><MIc d={I.git} size={17} /></span><span><b>Repo intelligence agent</b><i>idea</i></span></div>
      <div className="lc-trend t2"><span className="lc-ic"><MIc d={I.doc} size={17} /></span><span><b>Document Q&amp;A</b><i>idea</i></span></div>
      <div className="lc-trend t3"><span className="lc-ic"><MIc d={I.person} size={17} /></span><span><b>Portfolio reviewer</b><i>idea</i></span></div>
    </React.Fragment>
  )},
  { title: "Get 3 blueprint candidates", render: () => (
    <div className="lc-center">
      <div className="lc-row"><span className="n">A</span><b>Minimal</b><span className="pct">14 files</span></div>
      <div className="lc-row"><span className="n">B</span><b>Standard</b><span className="pct">recommended</span></div>
      <div className="lc-row"><span className="n">C</span><b>Production</b><span className="pct">58 files</span></div>
    </div>
  )},
  { title: "A controlled bundle, not a guess", render: () => (
    <div className="lc-center">
      <div className="lc-row"><span className="ck"><MIc d={I.doc} size={16} /></span><code>MATRIX_BLUEPRINT.yaml</code></div>
      <div className="lc-row"><span className="ck"><MIc d={I.shield} size={16} /></span><code>MATRIX_STANDARDS.lock</code></div>
      <div className="lc-row"><span className="ck"><MIc d={I.check} size={16} /></span><code>MATRIX_TASKS.md</code></div>
    </div>
  )},
  { title: "Send to any AI coder", render: () => (
    <div className="lc-center"><div className="lc-path">
      <span className="lc-chip">Claude Code</span><span className="lc-arrow">→</span>
      <span className="lc-chip">Codex</span><span className="lc-arrow">→</span>
      <span className="lc-chip">Cursor</span>
    </div></div>
  )},
  { title: "Validate, then publish to MatrixHub", render: () => (
    <div className="lc-center">
      {["Implemented under contract", "Passed validation", "Signed bundle", "Published to MatrixHub"].map(t => (
        <div className="lc-row" key={t}><span className="ck"><MIc d={I.check} size={18} /></span><b>{t}</b></div>
      ))}
    </div>
  )}
];
function Carousel() {
  const N = SLIDES.length;
  const [idx, setIdx] = uS(0);
  const [paused, setPaused] = uS(false);
  const tx = uR(null);
  uE(() => {
    if (paused) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setIdx(i => (i + 1) % N), 5000); return () => clearTimeout(t);
  }, [idx, paused, N]);
  const go = d => setIdx(i => (i + d + N) % N);
  return (
    <div className={"lc l-an d3" + (idx !== 0 ? " dim" : "")}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={e => { tx.current = e.touches[0].clientX; }}
      onTouchEnd={e => { if (tx.current == null) return; const dx = e.changedTouches[0].clientX - tx.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); tx.current = null; }}>
      <MNetwork />
      <div className="lc-top">
        <span className="lc-count">{idx + 1} / {N}</span>
        <span className="lc-arrows"><button onClick={() => go(-1)} aria-label="Previous">←</button><button onClick={() => go(1)} aria-label="Next">→</button></span>
      </div>
      <div className="lc-stage"><div className="lc-slide" key={idx}>{SLIDES[idx].render()}<div className="lc-title">{SLIDES[idx].title}</div></div></div>
      <div className="lc-dots">{SLIDES.map((_, i) => <button key={i} className={i === idx ? "on" : ""} onClick={() => setIdx(i)} aria-label={"Slide " + (i + 1)} />)}</div>
    </div>
  );
}

/* ---------- ring (scanning) ---------- */
function Ring({ value, size = 88, stroke = 6 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="mb-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#dbe7df" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#22c878" strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (value / 100) * c} style={{ transition: "stroke-dashoffset .35s ease" }} />
      </svg>
      <span className="pct">{value}</span>
    </div>
  );
}

/* ---------- copy button ---------- */
function Copy({ text, label = "Copy", onDone }) {
  const [done, setDone] = uS(false);
  return (
    <button className={"copybtn" + (done ? " done" : "")} onClick={(e) => {
      e.stopPropagation();
      try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (err) {}
      setDone(true); if (onDone) onDone(); setTimeout(() => setDone(false), 1500);
    }}><MIc d={done ? I.check : I.copy} size={15} />{done ? "Copied" : label}</button>
  );
}

/* ---------- top bar for builder pages ---------- */
function Bar({ onNew }) {
  return (
    <header className="mb-bar"><div className="l-wrap mb-bar-in">
      <div className="l-brand"><span className="gl">◇</span>Matrix Builder</div>
      <button className="mb-back" onClick={onNew}><MIc d={I.back} size={16} />New build</button>
    </div></header>
  );
}

const SCAN = ["Parsing your idea…", "Selecting standards", "Compiling blueprint candidates", "Locking the contract", "Packing your Matrix Bundle"];

function App() {
  const [phase, setPhase] = uS("hero");      // hero | scanning | candidates | bundle
  const [idea, setIdea] = uS("");
  const [scanIdx, setScanIdx] = uS(0);
  const [cands, setCands] = uS([]);
  const [chosen, setChosen] = uS(null);
  const [bundleId, setBundleId] = uS("");
  const [coder, setCoder] = uS("claude");
  const [toast, setToast] = uS(null);
  const [animSafe, setAnimSafe] = uS(false);

  uE(() => { setAnimSafe(false); const t = setTimeout(() => setAnimSafe(true), 1800); return () => clearTimeout(t); }, [phase]);

  const effIdea = (idea.trim() || MX.IDEA_EXAMPLES[0]);

  function showToast(msg) { setToast(msg); clearTimeout(showToast._t); showToast._t = setTimeout(() => setToast(null), 2600); }
  function generate() { setCands(MX.candidates(effIdea)); setScanIdx(0); setPhase("scanning"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  uE(() => {
    if (phase !== "scanning") return;
    if (scanIdx >= SCAN.length) { const t = setTimeout(() => setPhase("candidates"), 380); return () => clearTimeout(t); }
    const t = setTimeout(() => setScanIdx(i => i + 1), scanIdx === 0 ? 420 : 360); return () => clearTimeout(t);
  }, [phase, scanIdx]);
  function choose(c) { setChosen(c); setBundleId(MX.genId()); setPhase("bundle"); window.scrollTo({ top: 0, behavior: "smooth" }); }
  function reset() { setPhase("hero"); setChosen(null); window.scrollTo({ top: 0, behavior: "smooth" }); }

  const files = chosen ? MX.bundleFiles(effIdea, chosen, bundleId) : [];
  const prompt = chosen ? MX.coderPrompt(coder, effIdea, chosen, bundleId) : "";

  function downloadZip() {
    const blob = MX.MZIP.makeZip(files);
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = chosen.name + "-matrix-bundle.zip"; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    showToast("ZIP downloaded — open README.md first");
  }
  function copyPrompt() { try { navigator.clipboard.writeText(prompt); } catch (e) {} showToast("Prompt copied to clipboard"); }
  function sendTo(c) {
    try { navigator.clipboard.writeText(MX.coderPrompt(c.id, effIdea, chosen, bundleId)); } catch (e) {}
    if (c.url) window.open(c.url, "_blank", "noopener");
    showToast("Prompt copied — paste it into " + c.name);
  }

  return (
    <div className={"app" + (animSafe ? " anim-safe" : "")}>
      {/* ============ LANDING ============ */}
      {phase === "hero" && (
        <React.Fragment>
          <div className="l-dark">
            <header className="l-head"><div className="l-wrap l-head-in">
              <div className="l-brand"><span className="gl">◇</span>Matrix Builder</div>
              <nav className="l-nav">
                <a href="#how">Docs</a><a href="#what">Examples</a><a href="#trust">Trust</a>
                <a className="gh" href="https://github.com/ruslanmv" target="_blank" rel="noreferrer"><MIc d={I.git} size={18} />GitHub</a>
              </nav>
            </div></header>
            <section className="l-hero"><div className="l-wrap l-hero-grid">
              <div>
                <span className="l-eyebrow l-an"><span className="dot" />Controlled AI builds</span>
                <h1 className="l-h1 l-an d1">Give AI coders a <em>contract</em>,<br />not a <em>prompt</em>.</h1>
                <p className="l-sub l-an d2">Matrix Builder turns your idea into a controlled bundle — a blueprint, locked standards, and tasks your AI coder follows step by step.</p>
                <div className="l-form l-an d2">
                  <div className="l-idea">
                    <span className="ic"><MIc d={I.search} size={20} /></span>
                    <input value={idea} onChange={e => setIdea(e.target.value)} onKeyDown={e => { if (e.key === "Enter") generate(); }} placeholder="Describe what you want to build…" aria-label="Describe your idea" />
                    <button className="l-go" onClick={generate}>Generate blueprint <span aria-hidden="true">→</span></button>
                  </div>
                  <div className="l-chips">
                    <span className="ck">Try</span>
                    {MX.IDEA_EXAMPLES.slice(0, 3).map(ex => <button className="l-chip" key={ex} onClick={() => setIdea(ex)}>{ex}</button>)}
                  </div>
                </div>
              </div>
              <Carousel />
            </div></section>
          </div>

          <div className="l-light"><div className="l-wrap">
            <section className="l-sec" id="how">
              <span className="l-kicker">How it works</span>
              <div className="hiw stag">
                <div className="hiw-item"><span className="hiw-ic"><MIc d={I.person} size={24} /></span><div><div className="hiw-t"><span className="n">1</span>Describe your idea</div><div className="hiw-d">Tell Matrix Builder what you want to build.</div></div></div>
                <span className="hiw-line" />
                <div className="hiw-item"><span className="hiw-ic"><MIc d={I.layers} size={24} /></span><div><div className="hiw-t"><span className="n">2</span>Choose a blueprint</div><div className="hiw-d">Pick a controlled candidate with locked standards.</div></div></div>
                <span className="hiw-line" />
                <div className="hiw-item"><span className="hiw-ic"><MIc d={I.shield} size={24} /></span><div><div className="hiw-t"><span className="n">3</span>Build under control</div><div className="hiw-d">Send the bundle to your AI coder and validate it.</div></div></div>
              </div>
            </section>

            <section className="l-sec tight" id="what">
              <span className="l-kicker">What you get</span>
              <div className="wyg stag">
                <div className="wyg-card"><span className="wyg-ic"><MIc d={I.layers} size={26} /></span><div><div className="wyg-t">Blueprint candidates</div><div className="wyg-d">Three controlled architectures to choose from.</div></div></div>
                <div className="wyg-card"><span className="wyg-ic"><MIc d={I.cube} size={26} /></span><div><div className="wyg-t">Matrix Bundle</div><div className="wyg-d">Blueprint, standards lock, tasks and acceptance criteria.</div></div></div>
                <div className="wyg-card"><span className="wyg-ic"><MIc d={I.code} size={26} /></span><div><div className="wyg-t">Coder prompts</div><div className="wyg-d">Ready prompts for Claude Code, Codex, Cursor and more.</div></div></div>
                <div className="wyg-card"><span className="wyg-ic"><MIc d={I.check} size={26} /></span><div><div className="wyg-t">Validation</div><div className="wyg-d">Check the AI's output against the contract before you ship.</div></div></div>
              </div>
            </section>

            <section className="l-sec tight" id="trust">
              <div className="l-banner reveal">
                <span className="gl">◇</span>
                <div>
                  <div className="lb-h">Built for developers and <em>AI agents</em></div>
                  <div className="lb-d">Matrix Builder is a public API, bundle service and MCP-ready build layer — publish straight to MatrixHub.</div>
                </div>
                <div className="lb-pills">
                  <span className="lb-pill"><MIc d={I.code} size={15} />REST API</span>
                  <span className="lb-pill"><MIc d={I.shield} size={15} />Signed Bundles</span>
                  <span className="lb-pill"><MIc d={I.plug} size={15} />MCP Ready</span>
                </div>
              </div>
            </section>

            <footer className="l-foot"><div className="l-foot-in">
              <span>© 2026 Matrix Builder · ruslanmv.com</span>
              <span className="links"><a href="#">API</a><a href="#">Docs</a><a href="#">Trust</a><a href="https://www.matrixhub.io" target="_blank" rel="noreferrer">MatrixHub</a></span>
            </div></footer>
          </div></div>
        </React.Fragment>
      )}

      {/* ============ SCANNING ============ */}
      {phase === "scanning" && (
        <React.Fragment>
          <Bar onNew={reset} />
          <div className="l-wrap mb-page"><div className="mb-scan">
            <Ring value={Math.min(100, Math.round((scanIdx / SCAN.length) * 100))} />
            <div className="mb-scanlog">{SCAN[Math.min(scanIdx, SCAN.length - 1)]}</div>
            <div className="mb-scansub">{effIdea}</div>
          </div></div>
        </React.Fragment>
      )}

      {/* ============ CANDIDATES ============ */}
      {phase === "candidates" && (
        <React.Fragment>
          <Bar onNew={reset} />
          <div className="l-wrap mb-page">
            <div className="mb-head reveal">
              <span className="mb-eyebrow"><span className="d" />Step 1 · Choose a blueprint</span>
              <h2 className="mb-h2">Three controlled ways<br />to build <em>{effIdea.toLowerCase()}</em>.</h2>
              <p className="mb-sub">Every candidate ships with locked standards and a build contract. Pick the one that fits your scope.</p>
            </div>
            <div className="cand-grid stag">
              {cands.map(c => (
                <article key={c.id} className={"cand" + (c.recommended ? " rec" : "")} onClick={() => choose(c)}>
                  {c.recommended && <span className="cand-rec">Recommended</span>}
                  <div className="cand-tier">{c.tier}</div>
                  <div className="cand-name">{c.name}</div>
                  <div className="cand-sum">{c.summary}</div>
                  <div className="cand-meta">
                    <span className="mb-tag n">{c.files} files</span>
                    <span className="mb-tag n">{c.difficulty}</span>
                    <span className="mb-tag n">{c.time}</span>
                  </div>
                  <div className="cand-stack">{c.stack.map(s => <span className="mb-tag" key={s}>{s}</span>)}</div>
                  <button className="cand-choose">Choose this <MIc d={I.arrow} size={16} /></button>
                </article>
              ))}
            </div>
          </div>
        </React.Fragment>
      )}

      {/* ============ BUNDLE ============ */}
      {phase === "bundle" && chosen && (
        <React.Fragment>
          <Bar onNew={reset} />
          <div className="l-wrap mb-page">
            <article className="darkpanel bundle reveal">
              <div className="bundle-top">
                <div>
                  <span className="mb-eyebrow" style={{ color: "var(--grn-bright)" }}><span className="d" style={{ background: "var(--grn-bright)" }} />Your Matrix Bundle is ready</span>
                  <h2 className="bundle-h">{chosen.name}</h2>
                  <div className="bundle-id">Bundle <b>{bundleId}</b> · expires in 48h (guest)</div>
                  <div className="bundle-badges">
                    {chosen.standards.map(s => <span className="dbadge" key={s}><MIc d={I.shield} size={13} />{s}</span>)}
                  </div>
                </div>
              </div>

              <div className="bundle-grid">
                {/* coder prompt */}
                <div>
                  <div className="bx-label">Copy a prompt for your AI coder</div>
                  <div className="coder-seg">
                    {MX.CODERS.map(c => <button key={c.id} className={coder === c.id ? "on" : ""} onClick={() => setCoder(c.id)}>{c.short}</button>)}
                  </div>
                  <div className="codeblock">
                    <div className="codeblock-bar"><span className="fn">coder-prompts/{coder}.md</span><Copy text={prompt} /></div>
                    <pre>{prompt}</pre>
                  </div>
                  <div className="bx-label" style={{ marginTop: 22 }}>Or send it straight to</div>
                  <div className="send-grid">
                    {MX.CODERS.filter(c => c.id !== "generic").map(c => (
                      <button className="send-chip" key={c.id} onClick={() => sendTo(c)}><MIc d={I.send} size={15} />{c.name}</button>
                    ))}
                  </div>
                </div>

                {/* bundle contents */}
                <div>
                  <div className="bx-label">Bundle contents · {files.length} files</div>
                  <div className="ftree">
                    {files.filter(f => !f.name.includes("/")).map(f => (
                      <div className="fitem" key={f.name}><span className="fic"><MIc d={f.name.startsWith("MATRIX") ? I.shield : I.doc} size={15} /></span><span className="fname">{f.name}</span></div>
                    ))}
                    <div className="fitem dir">coder-prompts/</div>
                    {files.filter(f => f.name.includes("/")).map(f => (
                      <div className="fitem" key={f.name}><span className="fic"><MIc d={I.code} size={15} /></span><span className="fname">{f.name.split("/")[1]}</span></div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="build-opts">
                <button className="bo-btn primary" onClick={downloadZip}><MIc d={I.download} size={17} />Download ZIP</button>
                <button className="bo-btn" onClick={copyPrompt}><MIc d={I.copy} size={16} />Copy prompt</button>
                <button className="bo-btn" onClick={() => showToast("Sign in to validate AI output")}><MIc d={I.check} size={16} />Validate result</button>
              </div>
              <div className="bundle-foot">
                <button className="bundle-sec" onClick={() => showToast("Free account needed to save bundles")}>Save this bundle</button>
                <button className="bundle-sec" onClick={() => showToast("Free account needed to publish")}>Publish to MatrixHub</button>
              </div>
            </article>
          </div>
          <footer className="l-foot"><div className="l-wrap l-foot-in">
            <span>© 2026 Matrix Builder · ruslanmv.com</span>
            <span className="links"><a href="#">API</a><a href="#">Docs</a><a href="https://www.matrixhub.io" target="_blank" rel="noreferrer">MatrixHub</a></span>
          </div></footer>
        </React.Fragment>
      )}

      {toast && <div className="mb-toast"><MIc d={I.check} size={17} />{toast}</div>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
