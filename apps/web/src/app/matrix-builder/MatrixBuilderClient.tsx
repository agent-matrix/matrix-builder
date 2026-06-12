"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AI_CODERS, IDEA_EXAMPLES, SCANNING_MESSAGES } from "@/lib/constants";
import { createCoderPrompt } from "@/lib/coder-prompts";
import { createBundleFiles } from "@/lib/matrix-bundle";
import { createBlueprintCandidates } from "@/lib/matrix-demo-data";
import { generateBundleId } from "@/lib/ids";
import { makeZip } from "@/lib/zip";
import type { BlueprintCandidate } from "@/types/blueprint";
import type { BundleFile } from "@/types/bundle";
import type { AiCoder, CoderId } from "@/types/coder";

type Phase = "hero" | "scanning" | "candidates" | "bundle";

type IconDefinition = ReactNode;

function MatrixIcon({ children, size = 22, strokeWidth = 1.7 }: { children: IconDefinition; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const icons = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </>
  ),
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  layers: (
    <>
      <path d="M12 3.5l8.5 4.7L12 12.9 3.5 8.2 12 3.5z" />
      <path d="M3.5 13l8.5 4.7L20.5 13" />
    </>
  ),
  git: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="9" r="2.5" />
      <path d="M6 8.5v7M16 10.5c-3 1.5-7 .5-9 4" />
    </>
  ),
  doc: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.3l2.4 2.4 4.6-5" />
    </>
  ),
  cube: (
    <>
      <path d="M12 2.7l8 4.6v9.4l-8 4.6-8-4.6V7.3z" />
      <path d="M4 7.3l8 4.7 8-4.7M12 12v8.6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 2.5l7 3v5.5c0 4.3-2.9 7.4-7 9-4.1-1.6-7-4.7-7-9V5.5z" />
      <path d="M9 12l2 2 4-4.2" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2.2" />
      <path d="M5.5 15.5H5a1.5 1.5 0 01-1.5-1.5V5A1.5 1.5 0 015 3.5h9A1.5 1.5 0 0115.5 5v.5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12M7 10.5l5 5 5-5" />
      <path d="M4.5 20.5h15" />
    </>
  ),
  send: (
    <>
      <path d="M21 3L10.5 13.5" />
      <path d="M21 3l-6.5 18-4-8.5L2 8.5 21 3z" />
    </>
  ),
  code: (
    <>
      <path d="M8.5 7.5L4 12l4.5 4.5" />
      <path d="M15.5 7.5L20 12l-4.5 4.5" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.5-3.6 4-5.2 7-5.2s5.5 1.6 7 5.2" />
    </>
  ),
  plug: (
    <>
      <path d="M9 7.5V3.5M15 7.5V3.5" />
      <path d="M7 7.5h10v3.5a5 5 0 01-10 0V7.5z" />
      <path d="M12 16v4.5" />
    </>
  ),
  back: <path d="M14 6l-6 6 6 6" />,
};

function NetworkCanvas() {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const parent = canvas.parentElement;
    if (!ctx || !parent) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let frame = 0;
    let width = 0;
    let height = 0;

    const fit = () => {
      const rect = parent.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, width * dpr);
      canvas.height = Math.max(1, height * dpr);
    };
    fit();

    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    resizeObserver?.observe(parent);

    const nodeCount = 116;
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const nodes: Array<[number, number, number]> = [];
    for (let i = 0; i < nodeCount; i += 1) {
      const y = 1 - (i / (nodeCount - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = i * goldenAngle;
      nodes.push([Math.cos(theta) * radius, y, Math.sin(theta) * radius]);
    }

    const edges: Array<[number, number]> = [];
    for (let i = 0; i < nodeCount; i += 1) {
      for (let j = i + 1; j < nodeCount; j += 1) {
        const score = nodes[i][0] * nodes[j][0] + nodes[i][1] * nodes[j][1] + nodes[i][2] * nodes[j][2];
        if (score > 0.86) edges.push([i, j]);
      }
    }

    const hubs = [4, 22, 51, 78, 99].filter((index) => index < nodeCount);
    const pulses = Array.from({ length: Math.min(7, edges.length) }, (_, index) => ({
      edge: (index * 13) % edges.length,
      travel: Math.random(),
    }));

    const tilt = 0.5;
    const cosTilt = Math.cos(tilt);
    const sinTilt = Math.sin(tilt);
    let start = -1;

    const draw = (time: number) => {
      if (start < 0) start = time;
      const spin = reduced ? 0.6 : 0.6 + (time - start) * 0.00009;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const radius = width * 0.4;
      const centerX = width * 0.66;
      const centerY = height * 0.62;
      const cosSpin = Math.cos(spin);
      const sinSpin = Math.sin(spin);
      const projected = nodes.map(([x, y, z]) => {
        const rotatedX = x * cosSpin + z * sinSpin;
        const rotatedZ = -x * sinSpin + z * cosSpin;
        const rotatedY = y * cosTilt - rotatedZ * sinTilt;
        const tiltedZ = y * sinTilt + rotatedZ * cosTilt;
        return [centerX + rotatedX * radius, centerY - rotatedY * radius, tiltedZ] as const;
      });

      const glow = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius * 1.25);
      glow.addColorStop(0, "rgba(34,200,120,.12)");
      glow.addColorStop(1, "rgba(34,200,120,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      edges.forEach(([startIndex, endIndex]) => {
        const first = projected[startIndex];
        const second = projected[endIndex];
        const depth = (first[2] + second[2]) / 2;
        ctx.strokeStyle = `rgba(83,243,157,${(0.05 + (depth + 1) * 0.07).toFixed(3)})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(first[0], first[1]);
        ctx.lineTo(second[0], second[1]);
        ctx.stroke();
      });

      pulses.forEach((pulse) => {
        if (!reduced) pulse.travel += 0.006;
        if (pulse.travel > 1) {
          pulse.travel = 0;
          pulse.edge = (pulse.edge + 7) % edges.length;
        }
        const [startIndex, endIndex] = edges[pulse.edge];
        const first = projected[startIndex];
        const second = projected[endIndex];
        const x = first[0] + (second[0] - first[0]) * pulse.travel;
        const y = first[1] + (second[1] - first[1]) * pulse.travel;
        const dotGlow = ctx.createRadialGradient(x, y, 0, x, y, 5);
        dotGlow.addColorStop(0, "rgba(125,255,181,.9)");
        dotGlow.addColorStop(1, "rgba(125,255,181,0)");
        ctx.fillStyle = dotGlow;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
      });

      projected.forEach(([x, y, z]) => {
        const depth = (z + 1) / 2;
        ctx.fillStyle = `rgba(83,243,157,${(0.18 + depth * 0.55).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(x, y, 1 + depth * 1.8, 0, Math.PI * 2);
        ctx.fill();
      });

      hubs.forEach((nodeIndex, index) => {
        const [x, y, z] = projected[nodeIndex];
        if (z < -0.1) return;
        const pulse = reduced ? 1 : 0.7 + 0.3 * Math.sin(time / 600 + index * 1.6);
        const hubGlow = ctx.createRadialGradient(x, y, 0, x, y, 10 * pulse);
        hubGlow.addColorStop(0, "rgba(83,243,157,.7)");
        hubGlow.addColorStop(1, "rgba(83,243,157,0)");
        ctx.fillStyle = hubGlow;
        ctx.beginPath();
        ctx.arc(x, y, 10 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#7dffb5";
        ctx.beginPath();
        ctx.arc(x, y, 2.3, 0, Math.PI * 2);
        ctx.fill();
      });

      if (!reduced) frame = requestAnimationFrame(draw);
    };

    draw(performance.now());
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
    };
  }, []);

  return <canvas className="lc-globe-canvas" ref={ref} aria-hidden="true" />;
}

function Carousel() {
  const slides: Array<{ title: string; render: () => ReactNode }> = [
    {
      title: "Describe your idea",
      render: () => (
        <>
          <div className="lc-trend t1"><span className="lc-ic"><MatrixIcon size={17}>{icons.git}</MatrixIcon></span><span><b>Repo intelligence agent</b><i>idea</i></span></div>
          <div className="lc-trend t2"><span className="lc-ic"><MatrixIcon size={17}>{icons.doc}</MatrixIcon></span><span><b>Document Q&amp;A</b><i>idea</i></span></div>
          <div className="lc-trend t3"><span className="lc-ic"><MatrixIcon size={17}>{icons.person}</MatrixIcon></span><span><b>Portfolio reviewer</b><i>idea</i></span></div>
        </>
      ),
    },
    {
      title: "Get 3 blueprint candidates",
      render: () => (
        <div className="lc-center">
          <div className="lc-row"><span className="n">A</span><b>Minimal</b><span className="pct">14 files</span></div>
          <div className="lc-row"><span className="n">B</span><b>Standard</b><span className="pct">recommended</span></div>
          <div className="lc-row"><span className="n">C</span><b>Production</b><span className="pct">58 files</span></div>
        </div>
      ),
    },
    {
      title: "A controlled bundle, not a guess",
      render: () => (
        <div className="lc-center">
          <div className="lc-row"><span className="ck"><MatrixIcon size={16}>{icons.doc}</MatrixIcon></span><code>MATRIX_BLUEPRINT.yaml</code></div>
          <div className="lc-row"><span className="ck"><MatrixIcon size={16}>{icons.shield}</MatrixIcon></span><code>MATRIX_STANDARDS.lock</code></div>
          <div className="lc-row"><span className="ck"><MatrixIcon size={16}>{icons.check}</MatrixIcon></span><code>MATRIX_TASKS.md</code></div>
        </div>
      ),
    },
    {
      title: "Send to any AI coder",
      render: () => (
        <div className="lc-center">
          <div className="lc-path">
            <span className="lc-chip">Claude Code</span><span className="lc-arrow">→</span>
            <span className="lc-chip">Codex</span><span className="lc-arrow">→</span>
            <span className="lc-chip">GitPilot</span>
          </div>
        </div>
      ),
    },
    {
      title: "Validate, then publish to MatrixHub",
      render: () => (
        <div className="lc-center">
          {["Implemented under contract", "Passed validation", "Signed bundle", "Published to MatrixHub"].map((label) => (
            <div className="lc-row" key={label}><span className="ck"><MatrixIcon size={18}>{icons.check}</MatrixIcon></span><b>{label}</b></div>
          ))}
        </div>
      ),
    },
  ];

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    if (paused) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timeout = setTimeout(() => setIndex((current) => (current + 1) % slides.length), 5000);
    return () => clearTimeout(timeout);
  }, [index, paused, slides.length]);

  const go = (direction: number) => setIndex((current) => (current + direction + slides.length) % slides.length);

  return (
    <div
      className={`lc l-an d3${index !== 0 ? " dim" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => { touchX.current = event.touches[0].clientX; }}
      onTouchEnd={(event) => {
        if (touchX.current === null) return;
        const delta = event.changedTouches[0].clientX - touchX.current;
        if (Math.abs(delta) > 40) go(delta < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <NetworkCanvas />
      <div className="lc-top">
        <span className="lc-count">{index + 1} / {slides.length}</span>
        <span className="lc-arrows">
          <button type="button" onClick={() => go(-1)} aria-label="Previous slide">←</button>
          <button type="button" onClick={() => go(1)} aria-label="Next slide">→</button>
        </span>
      </div>
      <div className="lc-stage">
        <div className="lc-slide" key={index}>
          {slides[index].render()}
          <div className="lc-title">{slides[index].title}</div>
        </div>
      </div>
      <div className="lc-dots">
        {slides.map((slide, slideIndex) => (
          <button key={slide.title} type="button" className={slideIndex === index ? "on" : ""} onClick={() => setIndex(slideIndex)} aria-label={`Slide ${slideIndex + 1}`} />
        ))}
      </div>
    </div>
  );
}

function ProgressRing({ value, size = 88, stroke = 6 }: { value: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="mb-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#dbe7df" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#22c878"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (value / 100) * circumference}
          style={{ transition: "stroke-dashoffset .35s ease" }}
        />
      </svg>
      <span className="pct">{value}</span>
    </div>
  );
}

function CopyButton({ text, label = "Copy", onDone }: { text: string; label?: string; onDone?: () => void }) {
  const [done, setDone] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      // Clipboard can be unavailable in non-secure local contexts. The UI still gives feedback.
    }
    setDone(true);
    onDone?.();
    setTimeout(() => setDone(false), 1500);
  };

  return (
    <button className={`copybtn${done ? " done" : ""}`} type="button" onClick={copy}>
      <MatrixIcon size={15}>{done ? icons.check : icons.copy}</MatrixIcon>{done ? "Copied" : label}
    </button>
  );
}

function BuilderBar({ onNew }: { onNew: () => void }) {
  return (
    <header className="mb-bar">
      <div className="l-wrap mb-bar-in">
        <div className="l-brand"><span className="gl">◇</span>Matrix Builder</div>
        <button className="mb-back" type="button" onClick={onNew}><MatrixIcon size={16}>{icons.back}</MatrixIcon>New build</button>
      </div>
    </header>
  );
}

function FileTree({ files }: { files: BundleFile[] }) {
  const rootFiles = files.filter((file) => !file.name.includes("/"));
  const nestedFiles = files.filter((file) => file.name.includes("/"));
  return (
    <div className="ftree">
      {rootFiles.map((file) => (
        <div className="fitem" key={file.name}>
          <span className="fic"><MatrixIcon size={15}>{file.name.startsWith("MATRIX") ? icons.shield : icons.doc}</MatrixIcon></span>
          <span className="fname">{file.name}</span>
        </div>
      ))}
      <div className="fitem dir">docs/ and coder-prompts/</div>
      {nestedFiles.map((file) => (
        <div className="fitem" key={file.name}>
          <span className="fic"><MatrixIcon size={15}>{file.name.startsWith("coder-prompts") ? icons.code : icons.doc}</MatrixIcon></span>
          <span className="fname">{file.name}</span>
        </div>
      ))}
    </div>
  );
}

function LandingHero({ idea, setIdea, generate }: { idea: string; setIdea: (value: string) => void; generate: () => void }) {
  return (
    <>
      <div className="l-dark">
        <header className="l-head">
          <div className="l-wrap l-head-in">
            <div className="l-brand"><span className="gl">◇</span>Matrix Builder</div>
            <nav className="l-nav">
              <a href="#how">Docs</a>
              <a href="#what">Examples</a>
              <a href="#trust">Trust</a>
              <a className="gh" href="https://github.com/ruslanmv" target="_blank" rel="noreferrer"><MatrixIcon size={18}>{icons.git}</MatrixIcon>GitHub</a>
            </nav>
          </div>
        </header>
        <section className="l-hero">
          <div className="l-wrap l-hero-grid">
            <div>
              <span className="l-eyebrow l-an"><span className="dot" />Controlled AI builds</span>
              <h1 className="l-h1 l-an d1">Give AI coders a <em>contract</em>,<br />not a <em>prompt</em>.</h1>
              <p className="l-sub l-an d2">Matrix Builder turns your idea into a controlled bundle — a blueprint, locked standards, and tasks your AI coder follows step by step.</p>
              <div className="l-form l-an d2">
                <div className="l-idea">
                  <span className="ic"><MatrixIcon size={20}>{icons.search}</MatrixIcon></span>
                  <input value={idea} onChange={(event) => setIdea(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") generate(); }} placeholder="Describe what you want to build…" aria-label="Describe your idea" />
                  <button className="l-go" type="button" onClick={generate}>Generate blueprint <span aria-hidden="true">→</span></button>
                </div>
                <div className="l-chips">
                  <span className="ck">Try</span>
                  {IDEA_EXAMPLES.slice(0, 3).map((example) => <button className="l-chip" type="button" key={example} onClick={() => setIdea(example)}>{example}</button>)}
                </div>
              </div>
            </div>
            <Carousel />
          </div>
        </section>
      </div>

      <div className="l-light">
        <div className="l-wrap">
          <section className="l-sec" id="how">
            <span className="l-kicker">How it works</span>
            <div className="hiw stag">
              <div className="hiw-item"><span className="hiw-ic"><MatrixIcon size={24}>{icons.person}</MatrixIcon></span><div><div className="hiw-t"><span className="n">1</span>Describe your idea</div><div className="hiw-d">Tell Matrix Builder what you want to build.</div></div></div>
              <span className="hiw-line" />
              <div className="hiw-item"><span className="hiw-ic"><MatrixIcon size={24}>{icons.layers}</MatrixIcon></span><div><div className="hiw-t"><span className="n">2</span>Choose a blueprint</div><div className="hiw-d">Pick a controlled candidate with locked standards.</div></div></div>
              <span className="hiw-line" />
              <div className="hiw-item"><span className="hiw-ic"><MatrixIcon size={24}>{icons.shield}</MatrixIcon></span><div><div className="hiw-t"><span className="n">3</span>Build under control</div><div className="hiw-d">Send the bundle to your AI coder and validate it.</div></div></div>
            </div>
          </section>

          <section className="l-sec tight" id="what">
            <span className="l-kicker">What you get</span>
            <div className="wyg stag">
              <div className="wyg-card"><span className="wyg-ic"><MatrixIcon size={26}>{icons.layers}</MatrixIcon></span><div><div className="wyg-t">Blueprint candidates</div><div className="wyg-d">Three controlled architectures to choose from.</div></div></div>
              <div className="wyg-card"><span className="wyg-ic"><MatrixIcon size={26}>{icons.cube}</MatrixIcon></span><div><div className="wyg-t">Matrix Bundle</div><div className="wyg-d">Blueprint, standards lock, tasks, and acceptance criteria.</div></div></div>
              <div className="wyg-card"><span className="wyg-ic"><MatrixIcon size={26}>{icons.code}</MatrixIcon></span><div><div className="wyg-t">Coder prompts</div><div className="wyg-d">Ready prompts for Claude Code, Codex, GitPilot, and more.</div></div></div>
              <div className="wyg-card"><span className="wyg-ic"><MatrixIcon size={26}>{icons.check}</MatrixIcon></span><div><div className="wyg-t">Validation</div><div className="wyg-d">Check the AI output against the contract before you ship.</div></div></div>
            </div>
          </section>

          <section className="l-sec tight" id="trust">
            <div className="l-banner reveal">
              <span className="gl">◇</span>
              <div>
                <div className="lb-h">Built for developers and <em>AI agents</em></div>
                <div className="lb-d">Matrix Builder is a public API, bundle service, and MCP-ready build layer — publish straight to MatrixHub.</div>
              </div>
              <div className="lb-pills">
                <span className="lb-pill"><MatrixIcon size={15}>{icons.code}</MatrixIcon>REST API</span>
                <span className="lb-pill"><MatrixIcon size={15}>{icons.shield}</MatrixIcon>Signed Bundles</span>
                <span className="lb-pill"><MatrixIcon size={15}>{icons.plug}</MatrixIcon>MCP Ready</span>
              </div>
            </div>
          </section>

          <footer className="l-foot">
            <div className="l-foot-in">
              <span>© 2026 Matrix Builder · ruslanmv.com</span>
              <span className="links"><a href="#how">API</a><a href="#how">Docs</a><a href="#trust">Trust</a><a href="https://www.matrixhub.io" target="_blank" rel="noreferrer">MatrixHub</a></span>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}

function CandidateCard({ candidate, choose }: { candidate: BlueprintCandidate; choose: (candidate: BlueprintCandidate) => void }) {
  return (
    <article className={`cand${candidate.recommended ? " rec" : ""}`} onClick={() => choose(candidate)}>
      {candidate.recommended && <span className="cand-rec">Recommended</span>}
      <div className="cand-tier">{candidate.tier}</div>
      <div className="cand-name">{candidate.name}</div>
      <div className="cand-sum">{candidate.summary}</div>
      <div className="cand-meta">
        <span className="mb-tag n">{candidate.files} files</span>
        <span className="mb-tag n">{candidate.difficulty}</span>
        <span className="mb-tag n">{candidate.time}</span>
      </div>
      <div className="cand-stack">{candidate.stack.map((stack) => <span className="mb-tag" key={stack}>{stack}</span>)}</div>
      <button className="cand-choose" type="button">Choose this <MatrixIcon size={16}>{icons.arrow}</MatrixIcon></button>
    </article>
  );
}

function BundleResult({
  idea,
  candidate,
  bundleId,
  coder,
  setCoder,
  files,
  prompt,
  showToast,
}: {
  idea: string;
  candidate: BlueprintCandidate;
  bundleId: string;
  coder: CoderId;
  setCoder: (coder: CoderId) => void;
  files: BundleFile[];
  prompt: string;
  showToast: (message: string) => void;
}) {
  const downloadZip = () => {
    const blob = makeZip(files);
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${candidate.name}-matrix-bundle.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      URL.revokeObjectURL(anchor.href);
      anchor.remove();
    }, 1500);
    showToast("ZIP downloaded — open README.md first");
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard?.writeText(prompt);
    } catch {
      // Clipboard may not be available in every browser context.
    }
    showToast("Prompt copied to clipboard");
  };

  const sendTo = async (target: AiCoder) => {
    try {
      await navigator.clipboard?.writeText(createCoderPrompt(target.id, idea, candidate, bundleId));
    } catch {
      // Clipboard may not be available in every browser context.
    }
    if (target.url) window.open(target.url, "_blank", "noopener");
    showToast(`Prompt copied — paste it into ${target.name}`);
  };

  return (
    <article className="darkpanel bundle reveal">
      <div className="bundle-top">
        <div>
          <span className="mb-eyebrow" style={{ color: "var(--grn-bright)" }}><span className="d" style={{ background: "var(--grn-bright)" }} />Your Matrix Bundle is ready</span>
          <h2 className="bundle-h">{candidate.name}</h2>
          <div className="bundle-id">Bundle <b>{bundleId}</b> · expires in 48h (guest)</div>
          <div className="bundle-badges">
            {candidate.standards.map((standard) => <span className="dbadge" key={standard}><MatrixIcon size={13}>{icons.shield}</MatrixIcon>{standard}</span>)}
          </div>
        </div>
      </div>

      <div className="bundle-grid">
        <div>
          <div className="bx-label">Copy a controlled prompt for your AI coder</div>
          <div className="coder-seg">
            {AI_CODERS.map((item) => <button type="button" key={item.id} className={coder === item.id ? "on" : ""} onClick={() => setCoder(item.id)}>{item.short}</button>)}
          </div>
          <div className="codeblock">
            <div className="codeblock-bar"><span className="fn">coder-prompts/{coder}.md</span><CopyButton text={prompt} onDone={() => showToast("Prompt copied to clipboard")} /></div>
            <pre>{prompt}</pre>
          </div>
          <div className="allowed-box">
            <div className="allowed-title">Allowed files policy</div>
            <div className="allowed-grid">
              <span>backend/app/api/routes.py</span>
              <span>backend/tests/test_routes.py</span>
              <span>frontend/app/page.tsx</span>
              <span>frontend/components/hero.tsx</span>
            </div>
            <p>Every prompt says the AI coder is a worker, not an architect. It may implement only TASK-001 and must not modify MATRIX_* control files.</p>
          </div>
          <div className="bx-label" style={{ marginTop: 22 }}>Or send/fetch it with this bundle URL pattern</div>
          <div className="fetch-url">https://api.ruslanmv.com/v1/matrix-bundles/{bundleId}?open_file=coder-prompts/{coder}.md</div>
          <div className="bx-label" style={{ marginTop: 22 }}>Or send it straight to</div>
          <div className="send-grid">
            {AI_CODERS.filter((item) => item.id !== "generic-ai-coder").map((item) => (
              <button className="send-chip" type="button" key={item.id} onClick={() => void sendTo(item)}><MatrixIcon size={15}>{icons.send}</MatrixIcon>{item.name}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="bx-label">Bundle contents · {files.length} files</div>
          <FileTree files={files} />
        </div>
      </div>

      <div className="build-opts">
        <button className="bo-btn primary" type="button" onClick={downloadZip}><MatrixIcon size={17}>{icons.download}</MatrixIcon>Download ZIP</button>
        <button className="bo-btn" type="button" onClick={() => void copyPrompt()}><MatrixIcon size={16}>{icons.copy}</MatrixIcon>Copy prompt</button>
        <button className="bo-btn" type="button" onClick={() => showToast("Sign in to validate AI output")}><MatrixIcon size={16}>{icons.check}</MatrixIcon>Validate result</button>
      </div>
      <div className="bundle-foot">
        <button className="bundle-sec" type="button" onClick={() => showToast("Free account needed to save bundles")}>Save this bundle</button>
        <button className="bundle-sec" type="button" onClick={() => showToast("Free account needed to publish")}>Publish to MatrixHub</button>
      </div>
    </article>
  );
}

export default function MatrixBuilderClient() {
  const [phase, setPhase] = useState<Phase>("hero");
  const [idea, setIdea] = useState("");
  const [scanIndex, setScanIndex] = useState(0);
  const [candidates, setCandidates] = useState<BlueprintCandidate[]>([]);
  const [chosen, setChosen] = useState<BlueprintCandidate | null>(null);
  const [bundleId, setBundleId] = useState("");
  const [coder, setCoder] = useState<CoderId>("claude-code");
  const [toast, setToast] = useState<string | null>(null);
  const [animationSafe, setAnimationSafe] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setAnimationSafe(false);
    const timeout = setTimeout(() => setAnimationSafe(true), 1800);
    return () => clearTimeout(timeout);
  }, [phase]);

  const effectiveIdea = idea.trim() || IDEA_EXAMPLES[0];

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2600);
  };

  const generate = () => {
    setCandidates(createBlueprintCandidates(effectiveIdea));
    setScanIndex(0);
    setPhase("scanning");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (phase !== "scanning") return undefined;
    if (scanIndex >= SCANNING_MESSAGES.length) {
      const timeout = setTimeout(() => setPhase("candidates"), 380);
      return () => clearTimeout(timeout);
    }
    const timeout = setTimeout(() => setScanIndex((current) => current + 1), scanIndex === 0 ? 420 : 360);
    return () => clearTimeout(timeout);
  }, [phase, scanIndex]);

  const choose = (candidate: BlueprintCandidate) => {
    setChosen(candidate);
    setBundleId(generateBundleId());
    setPhase("bundle");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setPhase("hero");
    setChosen(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const files = chosen ? createBundleFiles(effectiveIdea, chosen, bundleId) : [];
  const prompt = chosen ? createCoderPrompt(coder, effectiveIdea, chosen, bundleId) : "";

  return (
    <div className={`app${animationSafe ? " anim-safe" : ""}`}>
      {phase === "hero" && <LandingHero idea={idea} setIdea={setIdea} generate={generate} />}

      {phase === "scanning" && (
        <>
          <BuilderBar onNew={reset} />
          <div className="l-wrap mb-page">
            <div className="mb-scan">
              <ProgressRing value={Math.min(100, Math.round((scanIndex / SCANNING_MESSAGES.length) * 100))} />
              <div className="mb-scanlog">{SCANNING_MESSAGES[Math.min(scanIndex, SCANNING_MESSAGES.length - 1)]}</div>
              <div className="mb-scansub">{effectiveIdea}</div>
            </div>
          </div>
        </>
      )}

      {phase === "candidates" && (
        <>
          <BuilderBar onNew={reset} />
          <div className="l-wrap mb-page">
            <div className="mb-head reveal">
              <span className="mb-eyebrow"><span className="d" />Step 1 · Choose a blueprint</span>
              <h2 className="mb-h2">Three controlled ways<br />to build <em>{effectiveIdea.toLowerCase()}</em>.</h2>
              <p className="mb-sub">Every candidate ships with locked standards and a build contract. Pick the one that fits your scope.</p>
            </div>
            <div className="cand-grid stag">
              {candidates.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} choose={choose} />)}
            </div>
          </div>
        </>
      )}

      {phase === "bundle" && chosen && (
        <>
          <BuilderBar onNew={reset} />
          <div className="l-wrap mb-page">
            <BundleResult idea={effectiveIdea} candidate={chosen} bundleId={bundleId} coder={coder} setCoder={setCoder} files={files} prompt={prompt} showToast={showToast} />
          </div>
          <footer className="l-foot">
            <div className="l-wrap l-foot-in">
              <span>© 2026 Matrix Builder · ruslanmv.com</span>
              <span className="links"><a href="#how">API</a><a href="#how">Docs</a><a href="https://www.matrixhub.io" target="_blank" rel="noreferrer">MatrixHub</a></span>
            </div>
          </footer>
        </>
      )}

      {toast && <div className="mb-toast"><MatrixIcon size={17}>{icons.check}</MatrixIcon>{toast}</div>}
    </div>
  );
}
