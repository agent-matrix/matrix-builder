"use client";

// Premium generated thumbnails for builds — a small "motor" that turns a build id into a unique,
// good-looking SVG. The 8 archetypes (sphere/mesh/radial/spiral/grid/pyramid/wave/beam) are the
// templates; per build we derive a cohesive green-family hue, jitter node positions, and rotate
// slightly — so every build gets its own premium thumbnail instead of one of 8 repeated images.
//
// Deterministic: the same id always yields the same thumbnail. Decorative only.
import type { ReactNode } from "react";

// --- deterministic seeded randomness ------------------------------------------------------
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ARCHETYPES = ["sphere", "mesh", "radial", "spiral", "grid", "pyramid", "wave", "beam"] as const;
type Archetype = (typeof ARCHETYPES)[number];

type Style = {
  rnd: () => number;
  core: string;
  line: string;
  uid: string;
  jit: number; // jitter amplitude
};

const CX = 120;
const CY = 65;

// jitter helper
const jx = (s: Style) => (s.rnd() - 0.5) * 2 * s.jit;

function dot(s: Style, x: number, y: number, r: number, k: string | number, big = false): ReactNode {
  return <circle key={`d${k}`} cx={x} cy={y} r={r} fill={s.core} filter={big ? `url(#f${s.uid})` : undefined} />;
}
function line(s: Style, a: number[], b: number[], k: number): ReactNode {
  return <line key={`l${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={s.line} strokeWidth={1} />;
}

function Sphere(s: Style): ReactNode {
  const base = [[120, 22], [156, 38], [176, 68], [168, 100], [134, 116], [98, 110], [74, 84], [86, 52], [120, 46], [144, 78], [108, 80], [130, 60]];
  const pts = base.map(([x, y]) => [x + jx(s), y + jx(s)]);
  const ed = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [8, 9], [8, 11], [10, 11], [9, 4], [10, 6], [11, 1], [8, 0], [10, 5]];
  return (
    <>
      <ellipse cx={CX} cy={68} rx="60" ry="58" fill={`url(#g${s.uid})`} />
      <ellipse cx={CX} cy={68} rx="58" ry="58" fill="none" stroke={s.line} strokeWidth="0.8" opacity=".5" />
      <ellipse cx={CX} cy={68} rx="28" ry="58" fill="none" stroke={s.line} strokeWidth="0.7" opacity=".4" />
      <ellipse cx={CX} cy={68} rx="58" ry="26" fill="none" stroke={s.line} strokeWidth="0.7" opacity=".4" />
      {ed.map((e, i) => line(s, pts[e[0]], pts[e[1]], i))}
      {pts.map((p, i) => dot(s, p[0], p[1], i % 3 === 0 ? 2.6 : 1.8, i, i % 3 === 0))}
    </>
  );
}
function Mesh(s: Style): ReactNode {
  const base = [[60, 40], [110, 28], [165, 44], [195, 80], [150, 104], [96, 100], [55, 78], [120, 66], [140, 80], [88, 60]];
  const pts = base.map(([x, y]) => [x + jx(s), y + jx(s)]);
  const ed = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [7, 0], [7, 1], [7, 2], [7, 8], [8, 3], [8, 4], [9, 6], [9, 0], [9, 7]];
  return (
    <>
      <ellipse cx="124" cy="68" rx="78" ry="52" fill={`url(#g${s.uid})`} />
      {ed.map((e, i) => line(s, pts[e[0]], pts[e[1]], i))}
      {pts.map((p, i) => dot(s, p[0], p[1], i === 7 ? 3 : 2, i, i === 7))}
    </>
  );
}
function Radial(s: Style): ReactNode {
  const n = 10 + Math.floor(s.rnd() * 4); // 10..13 spokes
  const off = s.rnd() * Math.PI;
  const spokes: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = off + (Math.PI * 2 * i) / n;
    const rad = 50 + jx(s);
    spokes.push([CX + Math.cos(a) * rad, 68 + Math.sin(a) * rad]);
  }
  return (
    <>
      <circle cx={CX} cy={68} r="56" fill={`url(#g${s.uid})`} />
      {[20, 36, 52].map((r, k) => <circle key={k} cx={CX} cy={68} r={r} fill="none" stroke={s.line} strokeWidth="0.7" opacity=".4" />)}
      {spokes.map((p, i) => line(s, [CX, 68], p, i))}
      {spokes.map((p, i) => dot(s, p[0], p[1], 1.8, i))}
      {dot(s, CX, 68, 3.4, "c", true)}
    </>
  );
}
function Spiral(s: Style): ReactNode {
  const n = 30 + Math.floor(s.rnd() * 8);
  const dir = s.rnd() < 0.5 ? 1 : -1;
  const pts: number[][] = [];
  for (let i = 0; i < n; i++) {
    const a = i * 0.5 * dir;
    const r = i * 1.7;
    pts.push([CX + Math.cos(a) * r, 68 + Math.sin(a) * r * 0.78]);
  }
  return (
    <>
      <ellipse cx={CX} cy={68} rx="66" ry="54" fill={`url(#g${s.uid})`} />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={1 + (i / n) * 2} fill={s.core} opacity={0.35 + (i / n) * 0.55} filter={i % 6 === 0 ? `url(#f${s.uid})` : undefined} />)}
    </>
  );
}
function Grid(s: Style): ReactNode {
  const cols = 7 + Math.floor(s.rnd() * 2); // 7..8
  const rows = 4;
  const pts: number[][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) pts.push([42 + c * (160 / (cols - 1)) * 0.9 + jx(s) * 0.5, 38 + r * 22 + jx(s) * 0.5]);
  const ed: number[][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = r * cols + c; if (c < cols - 1) ed.push([i, i + 1]); if (r < rows - 1) ed.push([i, i + cols]); }
  return (
    <>
      <ellipse cx={CX} cy={68} rx="76" ry="50" fill={`url(#g${s.uid})`} />
      {ed.map((e, i) => line(s, pts[e[0]], pts[e[1]], i))}
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i % 5 === 0 ? 2.4 : 1.5} fill={s.core} opacity=".75" filter={i % 5 === 0 ? `url(#f${s.uid})` : undefined} />)}
    </>
  );
}
function Pyramid(s: Style): ReactNode {
  const apex = [120 + jx(s) * 0.6, 26];
  const base = [[70, 108], [170, 108], [120, 96], [95, 67], [145, 67], [120, 60]].map(([x, y]) => [x + jx(s) * 0.5, y + jx(s) * 0.5]);
  const pts = [apex, ...base];
  const ed = [[0, 1], [0, 2], [1, 2], [0, 3], [4, 5], [0, 6]];
  return (
    <>
      <polygon points={`${apex[0]},${apex[1]} ${base[0][0]},${base[0][1]} ${base[1][0]},${base[1][1]}`} fill={`url(#g${s.uid})`} />
      {ed.map((e, i) => line(s, pts[e[0]], pts[e[1]], i))}
      {pts.map((p, i) => dot(s, p[0], p[1], i === 0 ? 3 : 2, i, i === 0))}
    </>
  );
}
function Wave(s: Style): ReactNode {
  const phase = s.rnd() * Math.PI * 2;
  const amp = 9 + s.rnd() * 8;
  const rows: number[][] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) rows.push([18 + c * 16, 50 + r * 13 + Math.sin(c * 0.6 + r * 0.5 + phase) * amp, 4 - r]);
  return (
    <>
      <rect width="240" height="130" fill={`url(#g${s.uid})`} opacity=".5" />
      {rows.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={1.3 + p[2] * 0.3} fill={s.core} opacity={0.4 + p[2] * 0.12} filter={i % 5 === 0 ? `url(#f${s.uid})` : undefined} />)}
    </>
  );
}
function Beam(s: Style): ReactNode {
  const flip = s.rnd() < 0.5;
  const pts: number[][] = [];
  for (let i = 0; i < 26; i++) { const t = i / 25; pts.push([20 + t * 200, 68 + Math.sin(i * 1.7 + s.rnd() * 0.2) * 0.5 * (8 + t * 30), t]); }
  const head = flip ? [20, 68] : [210, 68];
  return (
    <>
      <ellipse cx={flip ? 60 : 180} cy={68} rx="78" ry="40" fill={`url(#g${s.uid})`} />
      <line x1="20" y1="68" x2="210" y2="68" stroke={s.line} strokeWidth="0.8" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={0.8 + p[2] * 2.2} fill={s.core} opacity={0.3 + p[2] * 0.6} filter={i % 5 === 0 ? `url(#f${s.uid})` : undefined} />)}
      {dot(s, head[0], head[1], 3.4, "h", true)}
    </>
  );
}

const GEN: Record<Archetype, (s: Style) => ReactNode> = { sphere: Sphere, mesh: Mesh, radial: Radial, spiral: Spiral, grid: Grid, pyramid: Pyramid, wave: Wave, beam: Beam };

export default function BundleThumbnail({ seed, variant }: { seed?: string; variant?: string }) {
  // `seed` (the build id) drives the generator; `variant` is accepted for back-compat.
  const key = seed ?? variant ?? "matrix";
  const h = hashStr(key);
  const rnd = mulberry32(h);
  // Cohesive premium green→teal family, varied per build.
  const hue = 138 + Math.floor(rnd() * 52); // 138..189
  const core = `hsl(${hue}, 92%, 68%)`;
  const lineC = `hsla(${hue}, 88%, 64%, 0.30)`;
  const glowA = `hsla(${hue}, 96%, 62%, 0.26)`;
  const glowB = `hsla(${hue}, 96%, 62%, 0.05)`;
  const uid = h.toString(36);
  const archetype: Archetype = variant && (ARCHETYPES as readonly string[]).includes(variant)
    ? (variant as Archetype)
    : ARCHETYPES[h % ARCHETYPES.length];
  const rot = (rnd() - 0.5) * 14; // ±7°
  const style: Style = { rnd, core, line: lineC, uid, jit: 3 + rnd() * 4 };

  return (
    <svg viewBox="0 0 240 130" className="bundle-thumbnail" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`g${uid}`} cx="50%" cy="45%" r="58%">
          <stop offset="0%" stopColor={glowA} />
          <stop offset="60%" stopColor={glowB} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        <filter id={`f${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform={`rotate(${rot} ${CX} ${CY})`}>{GEN[archetype](style)}</g>
    </svg>
  );
}
