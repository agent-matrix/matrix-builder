/* global React */
const { useState, useEffect, useRef } = React;
const S = window.SCOUT;

/* ---------- brand mark: concentric radar ---------- */
function Mark({ size = 26, dark = false }) {
  const ring = dark ? "#54d98c" : "#15a05a";
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ flex: "none" }}>
      <circle cx="16" cy="16" r="14.5" stroke={ring} strokeWidth="1.4" opacity=".4" />
      <circle cx="16" cy="16" r="9" stroke={ring} strokeWidth="1.4" opacity=".7" />
      <circle cx="16" cy="16" r="3.2" fill={ring} />
      <path d="M16 16 L29 9" stroke={ring} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="24.5" cy="11" r="2" fill={ring} />
    </svg>
  );
}

/* ---------- animated score ring (with count-up) ---------- */
function ScoreRing({ value, size = 56, stroke = 5, label, dark = false }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const [off, setOff] = useState(c);
  const [num, setNum] = useState(0);
  useEffect(() => { const t = setTimeout(() => setOff(c - (value / 100) * c), 80); return () => clearTimeout(t); }, [value, c]);
  useEffect(() => {
    let raf; const dur = 900, start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setNum(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  const track = dark ? "rgba(255,255,255,.14)" : "#e7f4ec";
  const gid = "rg-" + (dark ? "d" : "l");
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={`url(#${gid})`} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)" }} />
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={dark ? "#54d98c" : "#15a05a"} /><stop offset="1" stopColor={dark ? "#34d399" : "#0e7340"} />
          </linearGradient>
        </defs>
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", lineHeight: 1 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "var(--mono)", fontWeight: 700, fontSize: size > 70 ? "1.3rem" : ".98rem", color: dark ? "#f2f8f4" : "var(--ink)", fontVariantNumeric: "tabular-nums" }}>{num}</div>
          {label && <div style={{ fontFamily: "var(--mono)", fontSize: ".5rem", letterSpacing: ".12em", color: dark ? "#9fbdb0" : "var(--faint)", textTransform: "uppercase", marginTop: 2 }}>{label}</div>}
        </div>
      </div>
    </div>
  );
}

/* ---------- radar bars ---------- */
function RadarBars({ dims, dark = false }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 120); return () => clearTimeout(t); }, []);
  return (
    <div className="radarbars">
      {Object.entries(dims).map(([k, v]) => (
        <div className={"rb " + (dark ? "dk" : "lt")} key={k}>
          <span className="lab">{k}</span>
          <span className="track"><i className="fill" style={{ width: on ? v + "%" : 0 }} /></span>
          <span className="num">{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- SVG radar polygon ---------- */
function RadarPolygon({ dims, size = 230, dark = false }) {
  const keys = Object.keys(dims);
  const cx = size / 2, cy = size / 2, R = size / 2 - 30;
  const pt = (i, rad) => { const a = (Math.PI * 2 * i) / keys.length - Math.PI / 2; return [cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]; };
  const rings = [0.25, 0.5, 0.75, 1];
  const dataPts = keys.map((k, i) => pt(i, (dims[k] / 100) * R));
  const [grow, setGrow] = useState(0);
  useEffect(() => {
    let f; const start = performance.now();
    const tick = (now) => { const p = Math.min(1, (now - start) / 900); setGrow(p < 1 ? 1 - Math.pow(1 - p, 3) : 1); if (p < 1) f = requestAnimationFrame(tick); };
    f = requestAnimationFrame(tick); return () => cancelAnimationFrame(f);
  }, []);
  const gridStroke = dark ? "rgba(120,200,160,.2)" : "rgba(21,160,90,.16)";
  const stroke = dark ? "#54d98c" : "#15a05a";
  const fill = dark ? "rgba(84,217,140,.16)" : "rgba(21,160,90,.12)";
  const lab = dark ? "#9fbdb0" : "#5e6b63";
  const poly = dataPts.map(([x, y]) => [cx + (x - cx) * grow, cy + (y - cy) * grow].join(",")).join(" ");
  return (
    <svg className="radar-poly" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((r, i) => <polygon key={i} points={keys.map((_, j) => pt(j, R * r).join(",")).join(" ")} fill="none" stroke={gridStroke} strokeWidth="1" />)}
      {keys.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={gridStroke} strokeWidth="1" />; })}
      <polygon points={poly} fill={fill} stroke={stroke} strokeWidth="2" />
      {dataPts.map(([x, y], i) => { const px = cx + (x - cx) * grow, py = cy + (y - cy) * grow; return <circle key={i} cx={px} cy={py} r="3.2" fill={stroke} />; })}
      {keys.map((k, i) => {
        const [x, y] = pt(i, R + 16);
        return <text key={k} x={x} y={y} fill={lab} fontSize="8.5" fontFamily="var(--mono)" fontWeight="600"
          textAnchor={Math.abs(x - cx) < 4 ? "middle" : x > cx ? "start" : "end"} dominantBaseline="middle"
          style={{ textTransform: "uppercase", letterSpacing: ".04em" }}>{k.split(" ")[0]}</text>;
      })}
    </svg>
  );
}

/* ---------- confidence (plain language) ---------- */
function Conf({ trust, pct = false }) {
  const high = trust.score >= 0.87;
  return <span className={"conf " + (high ? "high" : "med")}><span className="d" />{high ? "High" : "Medium"}{pct ? " · " + Math.round(trust.score * 100) + "%" : ""}</span>;
}

/* ---------- copy button ---------- */
function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button className={"copybtn" + (done ? " done" : "")} onClick={(e) => {
      e.stopPropagation();
      try { navigator.clipboard && navigator.clipboard.writeText(text); } catch (err) {}
      setDone(true); setTimeout(() => setDone(false), 1400);
    }}>{done ? "✓ Copied" : "Copy"}</button>
  );
}

/* ---------- sticky next-move bar ---------- */
function NextBar({ project, onView, onClose }) {
  return (
    <div className="nextbar">
      <div style={{ minWidth: 0 }}>
        <div className="nb-l">Your next move</div>
        <div className="nb-v">Build {project}</div>
      </div>
      <button className="btn primary small on-dark" onClick={onView}>View plan</button>
      <button className="nb-x" onClick={onClose} aria-label="Dismiss">✕</button>
    </div>
  );
}

/* ---------- opportunity card (quiet; ring + metrics only in advanced) ---------- */
function OpportunityCard({ topic, rank, onInspect, advanced }) {
  const dims = S.radar(topic);
  const score = S.composite(topic);
  const diff = S.difficulty(topic);
  return (
    <article className="card opcard" onClick={() => onInspect(topic)}>
      <div className="head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 className="title">{topic.short}</h4>
          <div className="act">{S.actionShort(topic)}</div>
        </div>
        {advanced ? <ScoreRing value={score} /> : <span className={"diff " + diff}>{diff}</span>}
      </div>
      {advanced && (
        <div className="metrics">
          <div className="metric"><div className="ml">Local relevance</div><div className="mv"><span className="minibar"><i style={{ width: dims["Local relevance"] + "%" }} /></span>{dims["Local relevance"]}</div></div>
          <div className="metric"><div className="ml">Global momentum</div><div className="mv"><span className="minibar"><i style={{ width: dims["Global momentum"] + "%" }} /></span>{dims["Global momentum"]}</div></div>
          <div className="metric"><div className="ml">Career value</div><div className="mv"><span className="minibar"><i style={{ width: dims["Career value"] + "%" }} /></span>{dims["Career value"]}</div></div>
          <div className="metric"><div className="ml">Difficulty</div><div className="mv"><span className={"diff " + diff}>{diff}</span></div></div>
        </div>
      )}
      <div className="bestproj"><span className="bp-k">Build</span>{topic.project_ideas[0]}</div>
      <div className="foot">
        <span className="whyrank">{S.whyRank(topic)}</span>
        <span className="inspect">Why? →</span>
      </div>
    </article>
  );
}

/* ---------- project card ---------- */
function ProjectCard({ idea, topic }) {
  const diff = S.difficulty(topic);
  return (
    <article className="card proj">
      <div className="ph"><span className="ptag">{topic.short}</span><span className={"diff " + diff} style={{ marginLeft: "auto" }}>{diff}</span></div>
      <h4>{idea}</h4>
      <p>Turn the {topic.short} signal into a portfolio piece — a focused repo, a live demo, and a writeup.</p>
      <div className="stack">{topic.skills.slice(0, 4).map(s => <span className="tag" key={s}>{s}</span>)}</div>
    </article>
  );
}

/* ---------- constellation decoration for dark panels ---------- */
function Constellation() {
  return (
    <svg className="net" viewBox="0 0 600 300" preserveAspectRatio="xMidYMid slice" fill="none">
      <path d="M-20 210 C 120 150, 240 250, 380 160 S 640 120, 700 170" stroke="rgba(84,217,140,.22)" strokeWidth="1" />
      <path d="M-20 250 C 140 220, 260 280, 420 210 S 660 190, 720 220" stroke="rgba(84,217,140,.14)" strokeWidth="1" />
      <path d="M120 40 L 300 110 L 470 60" stroke="rgba(84,217,140,.16)" strokeWidth="1" />
      {[[120, 40], [300, 110], [470, 60], [380, 160], [560, 130], [60, 150]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="8" fill="rgba(84,217,140,.12)" />
          <circle cx={x} cy={y} r="2.6" fill="#54d98c" />
        </g>
      ))}
    </svg>
  );
}

window.ScoutUI = { Mark, ScoreRing, RadarBars, RadarPolygon, Conf, CopyButton, NextBar, OpportunityCard, ProjectCard, Constellation };
