"use client";

// Premium abstract SVG thumbnails for saved bundles — decorative only.
// Ported from agent-matrix/design (scout/matrix-thumbs.jsx).
import type { ReactNode } from "react";

const G = "rgba(80,255,170,0.9)";
const L = "rgba(80,255,170,0.30)";

function Defs() {
  return (
    <defs>
      <radialGradient id="thGlow" cx="50%" cy="45%" r="55%">
        <stop offset="0%" stopColor="rgba(70,255,170,0.26)" />
        <stop offset="60%" stopColor="rgba(70,255,170,0.06)" />
        <stop offset="100%" stopColor="rgba(70,255,170,0)" />
      </radialGradient>
      <filter id="thNode" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2.2" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}
const dot = (x: number, y: number, r: number, k: number | string): ReactNode => (
  <circle key={`d${k}`} cx={x} cy={y} r={r} fill={G} filter="url(#thNode)" />
);
const line = (a: number[], b: number[], k: number): ReactNode => (
  <line key={`l${k}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={L} strokeWidth={1} />
);
const SVG = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 240 130" className="bundle-thumbnail" preserveAspectRatio="xMidYMid slice">
    <Defs />
    {children}
  </svg>
);

function Sphere() {
  const pts = [[120, 22], [156, 38], [176, 68], [168, 100], [134, 116], [98, 110], [74, 84], [86, 52], [120, 46], [144, 78], [108, 80], [130, 60]];
  const ed = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [8, 9], [8, 11], [10, 11], [9, 4], [10, 6], [11, 1], [8, 0], [10, 5]];
  return (
    <SVG>
      <ellipse cx="120" cy="68" rx="60" ry="58" fill="url(#thGlow)" />
      <ellipse cx="120" cy="68" rx="58" ry="58" fill="none" stroke={L} strokeWidth="0.8" opacity=".5" />
      <ellipse cx="120" cy="68" rx="28" ry="58" fill="none" stroke={L} strokeWidth="0.7" opacity=".4" />
      <ellipse cx="120" cy="68" rx="58" ry="26" fill="none" stroke={L} strokeWidth="0.7" opacity=".4" />
      {ed.map((e, i) => line(pts[e[0]], pts[e[1]], i))}
      {pts.map((p, i) => dot(p[0], p[1], i % 3 === 0 ? 2.6 : 1.8, i))}
    </SVG>
  );
}
function Wave() {
  const rows: number[][] = [];
  for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) rows.push([18 + c * 16, 50 + r * 13 + Math.sin(c * 0.6 + r * 0.5) * 12, 4 - r]);
  return (
    <SVG>
      <rect width="240" height="130" fill="url(#thGlow)" opacity=".5" />
      {rows.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={1.3 + p[2] * 0.3} fill={G} opacity={0.4 + p[2] * 0.12} filter={i % 5 === 0 ? "url(#thNode)" : undefined} />)}
    </SVG>
  );
}
function Mesh() {
  const pts = [[60, 40], [110, 28], [165, 44], [195, 80], [150, 104], [96, 100], [55, 78], [120, 66], [140, 80], [88, 60]];
  const ed = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [7, 0], [7, 1], [7, 2], [7, 8], [8, 3], [8, 4], [9, 6], [9, 0], [9, 7]];
  return (
    <SVG>
      <ellipse cx="124" cy="68" rx="78" ry="52" fill="url(#thGlow)" />
      {ed.map((e, i) => line(pts[e[0]], pts[e[1]], i))}
      {pts.map((p, i) => dot(p[0], p[1], i === 7 ? 3 : 2, i))}
    </SVG>
  );
}
function Radial() {
  const cx = 120, cy = 68;
  const spokes: number[][] = [];
  for (let i = 0; i < 12; i++) { const a = (Math.PI * 2 * i) / 12; spokes.push([cx + Math.cos(a) * 52, cy + Math.sin(a) * 52, i]); }
  return (
    <SVG>
      <circle cx={cx} cy={cy} r="56" fill="url(#thGlow)" />
      {[20, 36, 52].map((r, k) => <circle key={k} cx={cx} cy={cy} r={r} fill="none" stroke={L} strokeWidth="0.7" opacity=".4" />)}
      {spokes.map((p, i) => line([cx, cy], p, i))}
      {spokes.map((p, i) => dot(p[0], p[1], 1.8, i))}
      {dot(cx, cy, 3.4, 99)}
    </SVG>
  );
}
function Spiral() {
  const cx = 120, cy = 68;
  const pts: number[][] = [];
  for (let i = 0; i < 34; i++) { const a = i * 0.5, r = i * 1.7; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.78, i]); }
  return (
    <SVG>
      <ellipse cx={cx} cy={cy} rx="66" ry="54" fill="url(#thGlow)" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={1 + (i / 34) * 2} fill={G} opacity={0.35 + (i / 34) * 0.55} filter={i % 6 === 0 ? "url(#thNode)" : undefined} />)}
    </SVG>
  );
}
function Pyramid() {
  const pts = [[120, 26], [70, 108], [170, 108], [120, 96], [95, 67], [145, 67], [120, 60]];
  const ed = [[0, 1], [0, 2], [1, 2], [0, 3], [4, 5], [0, 6]];
  return (
    <SVG>
      <polygon points="120,26 70,108 170,108" fill="url(#thGlow)" />
      {ed.map((e, i) => line(pts[e[0]], pts[e[1]], i))}
      {pts.map((p, i) => dot(p[0], p[1], i === 0 ? 3 : 2, i))}
    </SVG>
  );
}
function Beam() {
  const pts: number[][] = [];
  for (let i = 0; i < 26; i++) { const t = i / 25; pts.push([20 + t * 200, 68 + (Math.sin(i * 1.7) * 0.5) * (8 + t * 30), t]); }
  return (
    <SVG>
      <ellipse cx="180" cy="68" rx="78" ry="40" fill="url(#thGlow)" />
      <line x1="20" y1="68" x2="210" y2="68" stroke={L} strokeWidth="0.8" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={0.8 + p[2] * 2.2} fill={G} opacity={0.3 + p[2] * 0.6} filter={i % 5 === 0 ? "url(#thNode)" : undefined} />)}
      {dot(210, 68, 3.4, 99)}
    </SVG>
  );
}
function Grid() {
  const pts: number[][] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) pts.push([42 + c * 22, 38 + r * 22]);
  const ed: number[][] = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) { const i = r * 8 + c; if (c < 7) ed.push([i, i + 1]); if (r < 3) ed.push([i, i + 8]); }
  return (
    <SVG>
      <ellipse cx="120" cy="68" rx="76" ry="50" fill="url(#thGlow)" />
      {ed.map((e, i) => line(pts[e[0]], pts[e[1]], i))}
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i % 5 === 0 ? 2.4 : 1.5} fill={G} opacity=".75" filter={i % 5 === 0 ? "url(#thNode)" : undefined} />)}
    </SVG>
  );
}

const MAP: Record<string, () => ReactNode> = { sphere: Sphere, wave: Wave, mesh: Mesh, radial: Radial, spiral: Spiral, pyramid: Pyramid, beam: Beam, grid: Grid };

export default function BundleThumbnail({ variant }: { variant: string }) {
  const C = MAP[variant] || Sphere;
  return <C />;
}
