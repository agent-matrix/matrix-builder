/* global React */
/* Scout landing — header, hero (form + carousel), how-it-works, what-you-get, agent banner, footer */
const { useState: uSL, useEffect: uEL, useRef: uRL } = React;
const SL = window.SCOUT;

const L_LOCS = SL.LOCATIONS.flatMap(l => l.cities.map(c => ({ label: c + ", " + l.country, city: c, country: l.country })));
const L_COORDS = {
  Rome: [41.9, 12.5], Milan: [45.46, 9.19], Turin: [45.07, 7.69],
  Berlin: [52.52, 13.40], Munich: [48.14, 11.58],
  Madrid: [40.42, -3.70], Barcelona: [41.39, 2.17],
  "San Francisco": [37.77, -122.42], "New York": [40.71, -74.01], Austin: [30.27, -97.74],
  London: [51.51, -0.13], Manchester: [53.48, -2.24],
  Bengaluru: [12.97, 77.59], Mumbai: [19.08, 72.88]
};

/* thin line icons */
function LIc({ d, size = 22, sw = 1.7 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
}
const L_ICONS = {
  trend: <React.Fragment><path d="M3 17l5.5-6.5 4 3.5L19 6" /><path d="M14.5 6H19v4.5" /></React.Fragment>,
  book: <React.Fragment><path d="M12 6c-2.2-1.6-5.3-1.6-8 0v12.5c2.7-1.6 5.8-1.6 8 0 2.2-1.6 5.3-1.6 8 0V6c-2.7-1.6-5.8-1.6-8 0z" /><path d="M12 6v12.5" /></React.Fragment>,
  code: <React.Fragment><path d="M8.5 7.5L4 12l4.5 4.5" /><path d="M15.5 7.5L20 12l-4.5 4.5" /></React.Fragment>,
  mega: <React.Fragment><path d="M3.5 11l13.5-6v14l-13.5-6v-2z" /><path d="M7.5 13.8V17a2.2 2.2 0 004.4 0v-1.4" /><path d="M20 9.5a4 4 0 010 5" /></React.Fragment>,
  person: <React.Fragment><circle cx="12" cy="8" r="3.5" /><path d="M5 19.5c1.5-3.6 4-5.2 7-5.2s5.5 1.6 7 5.2" /></React.Fragment>,
  pin: <React.Fragment><path d="M12 21.5S5 15 5 10a7 7 0 0114 0c0 5-7 11.5-7 11.5z" /><circle cx="12" cy="10" r="2.5" /></React.Fragment>,
  zap: <path d="M13 2.5L4.5 14H10l-1 7.5L17.5 10H12l1-7.5z" />,
  layers: <React.Fragment><path d="M12 3.5l8.5 4.7L12 12.9 3.5 8.2 12 3.5z" /><path d="M3.5 13l8.5 4.7L20.5 13" /></React.Fragment>,
  plug: <React.Fragment><path d="M9 7.5V3.5M15 7.5V3.5" /><path d="M7 7.5h10v3.5a5 5 0 01-10 0V7.5z" /><path d="M12 16v4.5" /></React.Fragment>,
  check: <React.Fragment><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12.3l2.4 2.4 4.6-5" /></React.Fragment>,
  db: <React.Fragment><ellipse cx="12" cy="5.5" rx="7" ry="2.6" /><path d="M5 5.5V18c0 1.45 3.1 2.6 7 2.6s7-1.15 7-2.6V5.5" /><path d="M5 11.8c0 1.45 3.1 2.6 7 2.6s7-1.15 7-2.6" /></React.Fragment>,
  git: <React.Fragment><circle cx="6" cy="6" r="2.5" /><circle cx="6" cy="18" r="2.5" /><circle cx="18" cy="9" r="2.5" /><path d="M6 8.5v7M16 10.5c-3 1.5-7 .5-9 4" /></React.Fragment>
};

/* ---------- globe visual: pseudo-3D rotating dot-matrix Earth on canvas ---------- */
/* coarse 48x24 equirectangular landmask ('#' = land), padded/clipped in JS */
const L_MAP = [
  "................................................",
  "........#######..####............#####..........",
  "......##########.#####....#####################.",
  "..##############.####.#..######################.",
  "..###.##########.......#.######################.",
  ".......########........########################.",
  ".......########.........###################.....",
  "........######........#####################.....",
  ".........###.........#####################......",
  "..........###........###################........",
  "...........###.......###########.##..##.........",
  ".............#####.....########......######.....",
  ".............######.....#######.......#######...",
  "..............#####......######.........####....",
  "..............####.......#####.#.......######...",
  "...............###........####.........######...",
  "...............##.........###............####...",
  "...............##.............................#.",
  "...............##............................##.",
  "...............##...............................",
  "................................................",
  "................................................",
  "................................................",
  "................................................"
].map(r => (r + "................................................").slice(0, 48));

const L_D2R = Math.PI / 180;
const L_CITIES = [[41.9, 12.5], [51.5, -0.1], [52.5, 13.4], [40.4, -3.7], [40.7, -74]];
const L_ARCS = [[0, 1], [0, 2], [0, 4]];

function LGlobe() {
  const ref = uRL(null);
  uEL(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0, W = 0, H = 0;
    const fit = () => {
      const r = canvas.parentElement.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = Math.max(1, W * dpr); canvas.height = Math.max(1, H * dpr);
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    if (ro) ro.observe(canvas.parentElement);

    // land dots: 4 jittered samples per land cell
    const dots = [];
    for (let ri = 0; ri < 24; ri++) for (let ci = 0; ci < 48; ci++) {
      if (L_MAP[ri][ci] !== "#") continue;
      for (let k = 0; k < 4; k++) {
        const lat = (90 - (ri + Math.random()) * 7.5) * L_D2R;
        const lon = (-180 + (ci + Math.random()) * 7.5) * L_D2R;
        dots.push([lat, lon]);
      }
    }
    // ambient specks floating around the globe
    const specks = [];
    for (let k = 0; k < 36; k++) specks.push([Math.random(), Math.random(), 0.4 + Math.random() * 0.6]);
    const cities = L_CITIES.map(([a, b]) => [a * L_D2R, b * L_D2R]);

    const TILT = 0.55, ct = Math.cos(TILT), st = Math.sin(TILT);
    const toVec = (lat, lon, spin) => {
      const cp = Math.cos(lat);
      return [cp * Math.sin(lon + spin), Math.sin(lat), cp * Math.cos(lon + spin)];
    };
    const slerp = (a, b, u) => {
      const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
      const om = Math.acos(d), so = Math.sin(om) || 1e-6;
      const f = Math.sin((1 - u) * om) / so, g2 = Math.sin(u * om) / so;
      return [a[0] * f + b[0] * g2, a[1] * f + b[1] * g2, a[2] * f + b[2] * g2];
    };

    let t0 = -1;
    const draw = (t) => {
      if (t0 < 0) t0 = t;
      const spin = reduced ? 0.3 : 0.3 + (t - t0) * 0.000022;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const R = W * 0.42, cx = W * 0.68, cy = H * 1.02;
      const pv = (v, m) => {
        const s = m || 1;
        const y = v[1] * ct - v[2] * st, z = v[1] * st + v[2] * ct;
        return [cx + v[0] * R * s, cy - y * R * s, z];
      };
      // atmosphere halo
      let g = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R * 1.28);
      g.addColorStop(0, "rgba(34,200,120,0)"); g.addColorStop(0.5, "rgba(34,200,120,.15)"); g.addColorStop(1, "rgba(34,200,120,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.28, 0, 7); ctx.fill();
      // sphere body
      g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.55, R * 0.1, cx, cy, R);
      g.addColorStop(0, "#104228"); g.addColorStop(0.55, "#072717"); g.addColorStop(1, "#031a10");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(83,243,157,.22)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
      // ambient specks
      for (let i = 0; i < specks.length; i++) {
        const tw = reduced ? 0.6 : 0.35 + 0.35 * Math.sin(t / 900 + i * 2.1);
        ctx.fillStyle = "rgba(83,243,157," + (tw * specks[i][2] * 0.5).toFixed(3) + ")";
        ctx.fillRect(specks[i][0] * W, specks[i][1] * H, 1.5, 1.5);
      }
      // land dots
      for (let i = 0; i < dots.length; i++) {
        const [sx, sy, z] = pv(toVec(dots[i][0], dots[i][1], spin));
        if (z < 0.02 || sy > H + 4) continue;
        ctx.fillStyle = "rgba(83,243,157," + (0.22 + z * 0.6).toFixed(3) + ")";
        const s = 1.3 + z * 1.6;
        ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
      }
      // arcs + moving sparks
      for (let i = 0; i < L_ARCS.length; i++) {
        const a = toVec(cities[L_ARCS[i][0]][0], cities[L_ARCS[i][0]][1], spin);
        const b = toVec(cities[L_ARCS[i][1]][0], cities[L_ARCS[i][1]][1], spin);
        ctx.beginPath();
        let vis = false;
        for (let s2 = 0; s2 <= 26; s2++) {
          const u = s2 / 26;
          const p = pv(slerp(a, b, u), 1 + 0.13 * Math.sin(u * Math.PI));
          if (p[2] < -0.05) { vis = false; continue; }
          if (!vis) { ctx.moveTo(p[0], p[1]); vis = true; } else ctx.lineTo(p[0], p[1]);
        }
        ctx.strokeStyle = "rgba(83,243,157,.4)"; ctx.lineWidth = 1.1; ctx.stroke();
        const u2 = reduced ? 0.5 : ((t / 2200) + i * 0.33) % 1;
        const sp = pv(slerp(a, b, u2), 1 + 0.13 * Math.sin(u2 * Math.PI));
        if (sp[2] > 0) {
          const g3 = ctx.createRadialGradient(sp[0], sp[1], 0, sp[0], sp[1], 6);
          g3.addColorStop(0, "rgba(125,255,181,.95)"); g3.addColorStop(1, "rgba(125,255,181,0)");
          ctx.fillStyle = g3; ctx.beginPath(); ctx.arc(sp[0], sp[1], 6, 0, 7); ctx.fill();
        }
      }
      // city nodes (pulsing)
      for (let i = 0; i < cities.length; i++) {
        const [sx, sy, z] = pv(toVec(cities[i][0], cities[i][1], spin));
        if (z < 0.05) continue;
        const pulse = reduced ? 1 : 0.75 + 0.25 * Math.sin(t / 620 + i * 1.7);
        const g4 = ctx.createRadialGradient(sx, sy, 0, sx, sy, 11 * pulse);
        g4.addColorStop(0, "rgba(83,243,157,.75)"); g4.addColorStop(1, "rgba(83,243,157,0)");
        ctx.fillStyle = g4; ctx.beginPath(); ctx.arc(sx, sy, 11 * pulse, 0, 7); ctx.fill();
        ctx.fillStyle = "#7dffb5"; ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, 7); ctx.fill();
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    draw(performance.now());
    return () => { cancelAnimationFrame(raf); if (ro) ro.disconnect(); };
  }, []);
  return <canvas className="lc-globe-canvas" ref={ref} aria-hidden="true" />;
}

/* ---------- carousel ---------- */
const L_SLIDES = [
  {
    title: "Discover signals near you",
    render: () => (
      <React.Fragment>
        <div className="lc-trend t1"><span className="lc-ic"><LIc d={L_ICONS.zap} size={17} /></span><span><b>AI Agents</b><i>+142%</i></span></div>
        <div className="lc-trend t2"><span className="lc-ic"><LIc d={L_ICONS.layers} size={17} /></span><span><b>RAG Systems</b><i>+87%</i></span></div>
        <div className="lc-trend t3"><span className="lc-ic"><LIc d={L_ICONS.plug} size={17} /></span><span><b>MCP Tools</b><i>+113%</i></span></div>
      </React.Fragment>
    )
  },
  {
    title: "Know what is rising",
    render: () => (
      <div className="lc-center">
        <div className="lc-row"><span className="n">#1</span><b>AI Agents</b><span className="pct">+142%</span></div>
        <div className="lc-row"><span className="n">#2</span><b>MCP Tools</b><span className="pct">+113%</span></div>
        <div className="lc-row"><span className="n">#3</span><b>RAG Systems</b><span className="pct">+87%</span></div>
      </div>
    )
  },
  {
    title: "Learn with a plan",
    render: () => (
      <div className="lc-center">
        <div className="lc-path">
          <span className="lc-chip">Learn</span><span className="lc-arrow">→</span>
          <span className="lc-chip">Build</span><span className="lc-arrow">→</span>
          <span className="lc-chip">Publish</span>
        </div>
      </div>
    )
  },
  {
    title: "Build portfolio projects",
    render: () => (
      <div className="lc-center">
        <div className="lc-bptitle">Local Trend Scout</div>
        <div className="lc-kv"><span className="k">Stack</span><span className="v">Python · FastAPI · MCP</span></div>
        <div className="lc-kv"><span className="k">Difficulty</span><span className="v">Medium</span></div>
        <div className="lc-kv"><span className="k">Output</span><span className="v">Live demo + repo</span></div>
      </div>
    )
  },
  {
    title: "Publish your work",
    render: () => (
      <div className="lc-center">
        {["GitHub repo", "Blog post", "LinkedIn update", "Live demo"].map(t => (
          <div className="lc-row" key={t}><span className="ck"><LIc d={L_ICONS.check} size={19} /></span><b>{t}</b></div>
        ))}
      </div>
    )
  }
];

function LCarousel() {
  const N = L_SLIDES.length;
  const [idx, setIdx] = uSL(0);
  const [paused, setPaused] = uSL(false);
  const touchX = uRL(null);
  uEL(() => {
    if (paused) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setIdx(i => (i + 1) % N), 5000);
    return () => clearTimeout(t);
  }, [idx, paused, N]);
  const go = d => setIdx(i => (i + d + N) % N);
  return (
    <div className={"lc l-an d3" + (idx !== 0 ? " dim" : "")}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={e => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={e => { if (touchX.current == null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); touchX.current = null; }}>
      <LGlobe />
      <div className="lc-top">
        <span className="lc-count">{idx + 1} / {N}</span>
        <span className="lc-arrows">
          <button onClick={() => go(-1)} aria-label="Previous slide">←</button>
          <button onClick={() => go(1)} aria-label="Next slide">→</button>
        </span>
      </div>
      <div className="lc-stage">
        <div className="lc-slide" key={idx}>
          {L_SLIDES[idx].render()}
          <div className="lc-title">{L_SLIDES[idx].title}</div>
        </div>
      </div>
      <div className="lc-dots">
        {L_SLIDES.map((_, i) => <button key={i} className={i === idx ? "on" : ""} onClick={() => setIdx(i)} aria-label={"Slide " + (i + 1)} />)}
      </div>
    </div>
  );
}

/* ---------- field ---------- */
function LField({ k, value, onChange, options }) {
  return (
    <label className="l-field">
      <span className="lf-k">{k}</span>
      <select value={value} onChange={onChange}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="lf-c">▾</span>
    </label>
  );
}

/* ---------- landing page ---------- */
function Landing({ profile, setProfile, city, country, setLocation, goal, setGoal, onGenerate }) {
  const [locating, setLocating] = uSL(false);
  const locLabel = city + ", " + country;
  function useMyLoc() {
    if (!navigator.geolocation || locating) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: la, longitude: lo } = pos.coords;
      let best = null, bd = Infinity;
      L_LOCS.forEach(o => {
        const c = L_COORDS[o.city]; if (!c) return;
        const d = (c[0] - la) * (c[0] - la) + (c[1] - lo) * (c[1] - lo);
        if (d < bd) { bd = d; best = o; }
      });
      if (best) setLocation(best.city, best.country);
      setLocating(false);
    }, () => setLocating(false), { timeout: 6000 });
  }
  return (
    <div className="landing">
      <div className="l-dark">
        <header className="l-head">
          <div className="l-wrap l-head-in">
            <div className="l-brand"><span className="gl">◇</span>Scout</div>
            <nav className="l-nav">
              <a href="#">API</a><a href="#">Methodology</a><a href="#">Trust</a>
              <a className="gh" href="https://github.com/ruslanmv" target="_blank" rel="noreferrer"><LIc d={L_ICONS.git} size={18} />GitHub</a>
            </nav>
          </div>
        </header>
        <section className="l-hero">
          <div className="l-wrap l-hero-grid">
            <div>
              <span className="l-eyebrow l-an"><span className="dot" />Your next move</span>
              <h1 className="l-h1 l-an d1">Find your <em>next</em><br /><em>developer move</em>.</h1>
              <p className="l-sub l-an d2">Scout turns technology signals into a simple plan: what to <em>learn</em>, what to <em>build</em>, and where to <em>publish</em>.</p>
              <div className="l-form l-an d2">
                <LField k="I'm a" value={profile} onChange={e => setProfile(e.target.value)} options={SL.PROFILES.map(p => ({ value: p, label: p }))} />
                <LField k="in" value={locLabel} onChange={e => { const o = L_LOCS.find(x => x.label === e.target.value); if (o) setLocation(o.city, o.country); }} options={L_LOCS.map(o => ({ value: o.label, label: o.label }))} />
                <LField k="I want to" value={goal} onChange={e => setGoal(e.target.value)} options={SL.GOALS.map(g => ({ value: g.id, label: g.label }))} />
              </div>
              <div className="l-cta-row l-an d4">
                <button className="l-btn" onClick={onGenerate}>Find my next move <span aria-hidden="true">→</span></button>
                <button className="l-loc" onClick={useMyLoc}>{locating ? "Locating…" : "Use my current location"}</button>
              </div>
            </div>
            <LCarousel />
          </div>
        </section>
      </div>

      <div className="l-light">
        <div className="l-wrap">
          <section className="l-sec">
            <span className="l-kicker">How it works</span>
            <div className="hiw">
              <div className="hiw-item">
                <span className="hiw-ic"><LIc d={L_ICONS.person} size={24} /></span>
                <div><div className="hiw-t"><span className="n">1</span>Choose your profile</div><div className="hiw-d">Tell us who you are and what you do.</div></div>
              </div>
              <span className="hiw-line" />
              <div className="hiw-item">
                <span className="hiw-ic"><LIc d={L_ICONS.pin} size={24} /></span>
                <div><div className="hiw-t"><span className="n">2</span>Pick your location</div><div className="hiw-d">We analyze your local tech ecosystem.</div></div>
              </div>
              <span className="hiw-line" />
              <div className="hiw-item">
                <span className="hiw-ic"><LIc d={L_ICONS.trend} size={24} /></span>
                <div><div className="hiw-t"><span className="n">3</span>Get your next move</div><div className="hiw-d">Receive a data-driven plan you can act on today.</div></div>
              </div>
            </div>
          </section>

          <section className="l-sec tight">
            <span className="l-kicker">What you get</span>
            <div className="wyg">
              <div className="wyg-card"><span className="wyg-ic"><LIc d={L_ICONS.trend} size={26} /></span><div><div className="wyg-t">Trending topics</div><div className="wyg-d">Top technologies rising locally and globally.</div></div></div>
              <div className="wyg-card"><span className="wyg-ic"><LIc d={L_ICONS.book} size={26} /></span><div><div className="wyg-t">Study paths</div><div className="wyg-d">Personalized learning plans with resources.</div></div></div>
              <div className="wyg-card"><span className="wyg-ic"><LIc d={L_ICONS.code} size={26} /></span><div><div className="wyg-t">Project blueprints</div><div className="wyg-d">Portfolio-ready ideas with tech stacks.</div></div></div>
              <div className="wyg-card"><span className="wyg-ic"><LIc d={L_ICONS.mega} size={26} /></span><div><div className="wyg-t">Visibility plans</div><div className="wyg-d">Step-by-step publishing and growth strategy.</div></div></div>
            </div>
          </section>

          <section className="l-sec tight">
            <div className="l-banner">
              <span className="gl">◇</span>
              <div>
                <div className="lb-h">Built for developers and <em>AI agents</em></div>
                <div className="lb-d">Scout is a public API, dashboard, dataset publisher, and MCP-ready intelligence layer.</div>
              </div>
              <div className="lb-pills">
                <span className="lb-pill"><LIc d={L_ICONS.code} size={15} />REST API</span>
                <span className="lb-pill"><LIc d={L_ICONS.db} size={15} />Open Data</span>
                <span className="lb-pill"><LIc d={L_ICONS.plug} size={15} />MCP Ready</span>
              </div>
            </div>
          </section>

          <footer className="l-foot">
            <div className="l-foot-in">
              <span>© 2026 Scout</span>
              <span className="links">
                <a href="#">API</a><a href="#">Methodology</a><a href="#">Trust</a>
                <a href="https://github.com/ruslanmv" target="_blank" rel="noreferrer"><LIc d={L_ICONS.git} size={16} />GitHub</a>
              </span>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

window.ScoutLanding = Landing;
