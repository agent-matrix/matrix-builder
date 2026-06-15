"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AuthControls from "./AuthControls";
import BundleThumbnail from "./BundleThumbnail";
import { AI_CODERS, IDEA_EXAMPLES, SCANNING_MESSAGES } from "@/lib/constants";
import { STAGES, timelineBatches, type Stage } from "@/lib/build-batches";
import { saveBuildProgress } from "@/lib/builds-store";
import { type BuildStatus } from "@/lib/saved-bundles";
import { createBundleFiles } from "@/lib/matrix-bundle";
import { createBlueprintCandidates } from "@/lib/matrix-demo-data";
import { toUiBundleFiles, toUiCandidates } from "@/lib/engine-map";
import { briefToIdea, enhanceProjectBrief, enrichBlueprintCandidates, explainValidationFindings, isOllaBridgeAssistAvailable, type EnrichmentMap } from "@/lib/ai-provider-manager";
import UploadExistingPlanModal, { type UploadSelection } from "@/components/matrix-builder/UploadExistingPlanModal";
import {
  downloadBundleZip,
  generateBundle as apiGenerateBundle,
  generateBundleFromBlueprint,
  getBlueprintCandidates,
  getBundle,
  getBundlePrompt,
  importBlueprint,
  ingestDocument,
  parseIdea,
  validateChanges,
} from "@/lib/workflow-client";
import { fetchTemplate, templateToIdea, type TemplateId } from "@/lib/templates";
import { CODER_ACTIONS } from "@/lib/coder-actions";
import { generateBundleId } from "@/lib/ids";
import { makeZip } from "@/lib/zip";
import type { BlueprintCandidate } from "@/types/blueprint";
import type { BundleFile, MatrixBundleContract } from "@/types/bundle";
import type { ProjectBriefContract } from "@/lib/workflow-types";
import type { CoderId } from "@/types/coder";
import type { ValidationReportContract } from "@/types/contracts";

type Phase = "hero" | "scanning" | "candidates" | "bundle" | "submit" | "running" | "validation" | "timeline" | "complete";

// Paths the AI coder reports as changed (parsed from the pasted result) → validated against the
// contract. status defaults to "modified".
type ChangedPath = { path: string; status: "added" | "modified" | "deleted" | "renamed" };

// --- Import-existing-plan helpers (Batches 4–6) ------------------------------------------------
function _rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function _strs(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
// Fold an arbitrary template/brief-shaped object into an idea string (fallback when an uploaded
// JSON isn't a complete blueprint).
function objToIdea(o: Record<string, unknown>): string {
  const name = typeof o.name === "string" ? o.name : typeof o.title === "string" ? o.title : "";
  const summary = typeof o.summary === "string" ? o.summary : "";
  const features = _strs(o.features);
  const parts = [name, summary].filter(Boolean);
  if (features.length) parts.push("Key features: " + features.slice(0, 6).join(", "));
  return parts.join(". ").slice(0, 3900);
}
// Minimal candidate so the bundle screen can render for an imported (skip-AI) blueprint.
function syntheticCandidate(b: Record<string, unknown>): BlueprintCandidate {
  const stack = _strs(Object.values(_rec(b.stack)));
  return {
    id: "standard",
    tier: "Standard",
    name: typeof b.name === "string" ? b.name : "Imported blueprint",
    summary: typeof b.idea === "string" ? b.idea : "User-provided blueprint",
    stack: stack.length ? stack : ["Next.js", "FastAPI"],
    files: _strs(b.required_files).length || 1,
    difficulty: "Medium",
    time: "—",
    standards: _strs(b.standards),
    candidate_id: typeof b.candidate_id === "string" ? b.candidate_id : undefined,
  };
}

// Pull file paths out of whatever the user pasted (a summary, a git diff, a file list). We look for
// path-shaped tokens and strip common diff/list prefixes; if nothing parses we fall back to the
// batch's allowed files so "Check AI output" always validates a real change set.
function parseChangedFiles(text: string, fallback: string[]): ChangedPath[] {
  const found = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^[-+*]\s+/, "").replace(/^(modified|added|deleted|renamed|M|A|D|R):?\s+/i, "");
    const token = line.split(/\s+/)[0]?.replace(/^["'`]|["'`]$/g, "");
    if (token && /^[\w][\w./-]*\.[A-Za-z0-9]+$/.test(token) && token.includes("/")) found.add(token);
  }
  const paths = found.size ? [...found] : fallback;
  return paths.map((path) => ({ path, status: "modified" as const }));
}

// A deterministic Matrix Commit id from the validation result (mirrors the CLI's mc-<hash>).
function deriveCommitId(report: ValidationReportContract): string {
  const seed = `${report.bundle_id}:${report.report_id}:${report.score}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `mc-${h.toString(16).padStart(8, "0")}${seed.length.toString(16).padStart(4, "0")}`;
}

// A build the user reopened from My Builds, reconstructed from persisted state.
export type InitialBuild = {
  candidate: BlueprintCandidate;
  idea: string;
  coder: CoderId;
  batchIndex: number;
  passed: number;
  bundleId: string;
};

// A slug-style build name reads nicer as a back-link title.
function prettyName(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bGithub\b/, "GitHub")
    .replace(/\bApi\b/, "API")
    .replace(/\bAi\b/, "AI")
    .replace(/\bQa\b/, "Q&A");
}

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
  plus: <path d="M12 5v14M5 12h14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l10-10-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  cpu: (
    <>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <path d="M9.5 9.5h5v5h-5z" />
      <path d="M9 3v2M15 3v2M9 19v2M15 19v2M3 9h2M3 15h2M19 9h2M19 15h2" />
    </>
  ),
  bundles: (
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
    </>
  ),
  refresh: (
    <>
      <path d="M4.5 12a7.5 7.5 0 0112.9-5.2L20 9" />
      <path d="M20 4v5h-5" />
      <path d="M19.5 12a7.5 7.5 0 01-12.9 5.2L4 15" />
      <path d="M4 20v-5h5" />
    </>
  ),
  chevR: <path d="M9 6l6 6-6 6" />,
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11.5v4.5" /><path d="M12 8h.01" /></>),
};

// Map each AI coder to one of the icons above (mirrors the design's CODER_ICON).
const CODER_ICON: Record<string, keyof typeof icons> = {
  "claude-code": "cube",
  "codex-chatgpt": "code",
  cursor: "arrow",
  gitpilot: "git",
  "ibm-bob": "layers",
  "generic-ai-coder": "plug",
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

function BuilderBar({ onNew, onNotice }: { onNew: () => void; onNotice?: (message: string) => void }) {
  return (
    <header className="mb-bar">
      <div className="l-wrap mb-bar-in">
        <a href="/matrix-builder" className="l-brand"><span className="gl">◇</span>Matrix Builder</a>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <button className="mb-back" type="button" onClick={onNew}><MatrixIcon size={16}>{icons.back}</MatrixIcon>New build</button>
          <AuthControls onNotice={onNotice} />
        </span>
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

function LandingHero({ idea, setIdea, generate, onUpload }: { idea: string; setIdea: (value: string) => void; generate: () => void; onUpload: () => void }) {
  // One rotating "Try" suggestion — a fresh, random idea on every visit (and on shuffle).
  const [suggestion, setSuggestion] = useState<string>(IDEA_EXAMPLES[0]);
  const [touched, setTouched] = useState(false);
  const empty = !idea.trim();
  const shuffle = () => setSuggestion((cur) => {
    const pool = IDEA_EXAMPLES.filter((e) => e !== cur);
    return pool[Math.floor(Math.random() * pool.length)] ?? cur;
  });
  useEffect(() => { setSuggestion(IDEA_EXAMPLES[Math.floor(Math.random() * IDEA_EXAMPLES.length)]); }, []);
  return (
    <>
      <div className="l-dark">
        <header className="l-head">
          <div className="l-wrap l-head-in">
            <a href="/matrix-builder" className="l-brand"><span className="gl">◇</span>Matrix Builder</a>
            <nav className="l-nav">
              <a href="/matrix-builder/about">About</a>
              <a href="https://agent-matrix.github.io/matrix-definitions/definitions/">Definitions</a>
              <a className="gh" href="https://github.com/agent-matrix/matrix-builder" target="_blank" rel="noreferrer"><MatrixIcon size={18}>{icons.git}</MatrixIcon>GitHub</a>
              <AuthControls />
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
                  <input value={idea} onChange={(event) => setIdea(event.target.value)} onBlur={() => setTouched(true)} onKeyDown={(event) => { if (event.key === "Enter") generate(); }} placeholder="Describe what you want to build…" aria-label="Describe your idea" />
                  <button className="l-go" type="button" onClick={() => generate()} disabled={empty} title={empty ? "Add an idea or upload a brief/design to continue." : undefined}>Generate blueprint <span aria-hidden="true">→</span></button>
                </div>
                {touched && empty && <p className="l-hint">Add an idea or upload a brief/design to continue.</p>}
                <div className="l-chips">
                  <span className="ck">Try</span>
                  <button className="l-chip" type="button" onClick={() => setIdea(suggestion)} key={suggestion}>{suggestion}</button>
                  <button className="l-shuffle" type="button" onClick={shuffle} aria-label="Show another idea" title="Show another idea">↻</button>
                </div>
                <button className="l-upload-link" type="button" onClick={onUpload} aria-label="Upload a brief, blueprint, design, or JSON" title="Upload a brief, blueprint, design, or JSON">
                  <MatrixIcon size={15}>{icons.plug}</MatrixIcon>Attach
                </button>
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
              <span className="links"><a href="#how">API</a><a href="https://agent-matrix.github.io/matrix-builder/" target="_blank" rel="noreferrer">Docs</a><a href="#trust">Trust</a><a href="https://www.matrixhub.io" target="_blank" rel="noreferrer">MatrixHub</a></span>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}

function CandidateCard({ candidate, choose, enrichment }: { candidate: BlueprintCandidate; choose: (candidate: BlueprintCandidate) => void; enrichment?: { displayName?: string; displaySummary?: string } }) {
  // Display-only: the deterministic candidate still drives bundle generation. AI may only soften
  // the visible name/summary; an explicit badge tells the user the wording was AI-assisted.
  const name = enrichment?.displayName ?? candidate.name;
  const summary = enrichment?.displaySummary ?? candidate.summary;
  const aiAssisted = Boolean(enrichment?.displayName || enrichment?.displaySummary);
  return (
    <article className={`cand${candidate.recommended ? " rec" : ""}`} onClick={() => choose(candidate)}>
      {candidate.recommended && <span className="cand-rec">Recommended</span>}
      <div className="cand-tier">{candidate.tier}</div>
      <div className="cand-name">{name}</div>
      <div className="cand-sum">{summary}</div>
      {aiAssisted && <span className="cand-ai-badge">✦ AI-assisted wording</span>}
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

// Per-batch coder prompt, matching the design's batchCoderPrompt.
function batchPrompt(coderName: string, buildName: string, stage: Stage, generic: boolean): string {
  const intro = generic ? "You are the implementation worker." : `You are ${coderName}, an expert software engineer.`;
  if (stage.n === "01") {
    return `${intro}
Build the initial project skeleton for the ${buildName}.
Follow the blueprint and standards in this bundle.
Do not implement features yet—create the structure, configs, and placeholders only.
Return the full file tree and mark all tasks as complete.
Return: files changed, commands run, test result, and a short summary.`;
  }
  return `${intro}
Batch ${stage.n} — ${stage.title}.
${stage.goal}

Rules:
- Implement only Batch ${stage.n}.
- Do not change MATRIX_BLUEPRINT.yaml or MATRIX_STANDARDS.lock.
- Update tests and docs accordingly.
Return: files changed, commands run, test result, and a short summary.`;
}

function BundleResult({
  candidate,
  batchIndex,
  coder,
  setCoder,
  prompt,
  promptLoading,
  bundleLoading,
  fileCount,
  showToast,
  onNew,
  onMyBuilds,
  onSubmit,
  onTimeline,
  onDownload,
}: {
  candidate: BlueprintCandidate;
  batchIndex: number;
  coder: CoderId;
  setCoder: (coder: CoderId) => void;
  prompt: string;
  promptLoading: boolean;
  bundleLoading: boolean;
  fileCount: number;
  showToast: (message: string) => void;
  onNew: () => void;
  onMyBuilds: () => void;
  onSubmit: () => void;
  onTimeline: () => void;
  onDownload: () => void;
}) {
  const buildName = candidate.name;
  const coderEntry = AI_CODERS.find((item) => item.id === coder) ?? AI_CODERS[1];
  const cur = STAGES[batchIndex];
  const [extraDetail, setExtraDetail] = useState("");

  // Single source of truth: the sidebar actions follow the SELECTED coder (no hardcoded Claude).
  const actions = CODER_ACTIONS[coder] ?? CODER_ACTIONS["generic-ai-coder"];
  // What we hand the agent = the controlled prompt (it already embeds the signed bundle URL) plus
  // any extra detail the user added.
  const handoffText = () => prompt + (extraDetail.trim() ? `\n\nExtra detail: ${extraDetail.trim()}` : "");
  const runCoderAction = (a: { label: string; kind: "open" | "copy"; url?: string }) => {
    try { void navigator.clipboard?.writeText(handoffText()); } catch { /* clipboard unavailable */ }
    if (a.kind === "open" && a.url) {
      showToast(`Prompt copied — opening ${coderEntry.short}…`);
      window.open(a.url, "_blank", "noopener");
    } else {
      showToast(`Prompt copied — paste it into ${coderEntry.short}`);
    }
  };

  const copyPrompt = async () => {
    if (!prompt) return;
    try {
      await navigator.clipboard?.writeText(prompt);
    } catch {
      // Clipboard may not be available in every browser context.
    }
    showToast("Prompt copied to clipboard");
  };

  return (
    <div className="mb-dark-page">
      <header className="mb-detail-bar"><div className="l-wrap dbar-in">
        <a href="/matrix-builder" className="l-brand"><span className="gl">◇</span>Matrix Builder</a>
        <div className="dbar-r" style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <button className="l-newbuild" type="button" onClick={onNew}><MatrixIcon size={15}>{icons.plus}</MatrixIcon>New build</button>
          <AuthControls onNotice={showToast} />
        </div>
      </div></header>

      <div className="brx">
        {/* LEFT: build progress rail */}
        <aside className="brx-rail reveal">
          <div className="brx-rail-k">Build progress</div>
          <div className="brx-stages">
            {STAGES.map((stage, i) => {
              const state = i < batchIndex ? "passed" : i === batchIndex ? "ready" : "planned";
              return (
                <button
                  key={stage.n}
                  type="button"
                  className={`brx-stage ${state}${i === batchIndex ? " on" : ""}`}
                  onClick={() => {
                    if (state === "passed") showToast(`Batch ${stage.n} passed — Matrix Commit #0${stage.n}`);
                    else if (state === "planned") showToast(`Batch ${stage.n} is planned — not started yet`);
                  }}
                >
                  <span className="brx-srail">
                    <span className={`brx-node ${state}`}>{state === "passed" ? <MatrixIcon size={13}>{icons.check}</MatrixIcon> : state === "ready" ? <span className="brx-dot" /> : null}</span>
                    {i < STAGES.length - 1 && <span className="brx-line" />}
                  </span>
                  <span className="brx-sbody"><span className="brx-sn">{stage.n}</span><span className="brx-st">{stage.short}</span></span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* CENTER: current batch prompt */}
        <div className="brx-center">
          <button className="upd-back reveal" type="button" onClick={onMyBuilds}><MatrixIcon size={15}>{icons.back}</MatrixIcon>My Builds</button>
          <h1 className="br-h1 reveal">{buildName}</h1>
          <div className="br-meta reveal">v1.0.0 <span className="dm-sep">·</span> <span className="dm-batch">Batch {cur.n}</span> <span className="dm-sep">·</span> <span className="br-ready"><span className="dm-dot" />Ready</span></div>

          <div className="br-label reveal">Choose AI coder</div>
          <div className="br-coders reveal">
            {AI_CODERS.map((item) => (
              <button key={item.id} type="button" className={`br-coder${coder === item.id ? " on" : ""}`} onClick={() => setCoder(item.id)}>
                <span className="br-cic"><MatrixIcon size={18}>{icons[CODER_ICON[item.id] ?? "plug"]}</MatrixIcon></span>{item.short}
              </button>
            ))}
          </div>

          <article className="darkpanel br-prompt reveal">
            <div className="br-prompt-bar"><span className="br-pt">Prompt preview — <span className="cc-grn">{coderEntry.short}</span></span>{!promptLoading && prompt && <CopyButton text={prompt} onDone={() => showToast("Prompt copied to clipboard")} />}</div>
            {promptLoading ? (
              <pre className="br-prompt-skel" aria-busy="true">
                <span className="skel-line" />
                <span className="skel-line w80" />
                <span className="skel-line w60" />
                <span className="skel-line w90" />
                <span className="skel-line w50" />
              </pre>
            ) : (
              <pre>{prompt}{"\n\n..."}</pre>
            )}
          </article>
          <button className="bo-btn primary br-copy reveal" type="button" disabled={promptLoading || !prompt} onClick={() => void copyPrompt()}><MatrixIcon size={17}>{icons.copy}</MatrixIcon>Copy Batch {cur.n} prompt</button>
        </div>

        {/* RIGHT: hand off to a coding agent, then confirm the run */}
        <aside className="brx-right">
          <article className="darkpanel br-next reveal">
            <div className="br-next-top"><span className="br-next-ic"><MatrixIcon size={22}>{icons.plug}</MatrixIcon></span><span className="br-next-k">{actions.title}</span></div>
            <div className="br-next-d">{actions.description}</div>
            <button className="bo-btn primary full" type="button" disabled={promptLoading || !prompt} onClick={() => runCoderAction(actions.primary)}><MatrixIcon size={16}>{actions.primary.kind === "open" ? icons.cpu : icons.copy}</MatrixIcon>{actions.primary.label}</button>
            {actions.secondary && (
              <button className="bo-btn full" type="button" disabled={promptLoading || !prompt} onClick={() => runCoderAction(actions.secondary!)}><MatrixIcon size={16}>{actions.secondary.kind === "open" ? icons.cpu : icons.copy}</MatrixIcon>{actions.secondary.label}</button>
            )}
            <button className="bo-btn full" type="button" disabled={bundleLoading} onClick={onDownload}><MatrixIcon size={16}>{icons.download}</MatrixIcon>{bundleLoading ? "Preparing bundle…" : `Download ZIP instead (${fileCount})`}</button>
            <details className="br-detail">
              <summary>{actions.detailLabel} (optional)</summary>
              <textarea className="br-detail-ta" rows={3} value={extraDetail} placeholder="e.g. use Tailwind, add a footer, keep it minimal…" onChange={(e) => setExtraDetail(e.target.value)} />
            </details>
          </article>
          <article className="darkpanel br-next reveal">
            <div className="br-next-t">Ran it? Check the result.</div>
            <div className="br-next-d">After your agent implements Batch {cur.n}, submit what changed and Matrix validates it.</div>
            <button className="bo-btn primary full" type="button" disabled={bundleLoading} onClick={onSubmit}><MatrixIcon size={16}>{icons.check}</MatrixIcon>I ran this batch</button>
            <button className="bo-btn full" type="button" onClick={onTimeline}><MatrixIcon size={16}>{icons.clock}</MatrixIcon>View timeline</button>
          </article>
        </aside>
      </div>
    </div>
  );
}

// Submit-AI-result page — paste/diff/zip tabs, then "Check AI output" runs validation.
function SubmitResult({
  batchIndex,
  fallbackFiles,
  showToast,
  onNew,
  onBack,
  onValidate,
}: {
  batchIndex: number;
  fallbackFiles: string[];
  showToast: (message: string) => void;
  onNew: () => void;
  onBack: () => void;
  onValidate: (changed: ChangedPath[]) => void;
}) {
  const cur = STAGES[batchIndex];
  const [resTab, setResTab] = useState<"summary" | "diff" | "zip">("summary");
  const [result, setResult] = useState("");
  const runValidation = () => onValidate(parseChangedFiles(result, fallbackFiles));
  const tabs: Array<[typeof resTab, string, keyof typeof icons]> = [
    ["summary", "Paste summary", "edit"],
    ["diff", "Paste git diff", "code"],
    ["zip", "Upload ZIP", "download"],
  ];
  const placeholder =
    resTab === "zip"
      ? "Drop the generated project ZIP here, or click to browse."
      : "Paste the AI coder result here…\n\nFiles changed:\n- backend/main.py\n\nCommands run:\n- pytest\n\nResult: Build passed.";

  return (
    <div className="mb-dark-page">
      <header className="mb-detail-bar"><div className="l-wrap dbar-in">
        <a href="/matrix-builder" className="l-brand"><span className="gl">◇</span>Matrix Builder</a>
        <div className="dbar-r" style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <button className="l-newbuild" type="button" onClick={onNew}><MatrixIcon size={15}>{icons.plus}</MatrixIcon>New build</button>
          <AuthControls onNotice={showToast} />
        </div>
      </div></header>

      <div className="l-wrap srp">
        <button className="upd-back reveal" type="button" onClick={onBack}><MatrixIcon size={15}>{icons.back}</MatrixIcon>Batch {cur.n}</button>
        <h1 className="val-h1 reveal">Submit AI result</h1>
        <p className="upd-sub reveal">Paste what your AI coder produced for Batch {cur.n} — {cur.title}. Matrix Builder will validate it against the contract.</p>

        <article className="darkpanel srp-card reveal">
          <div className="paste-tabs">
            {tabs.map(([key, label, icon]) => (
              <button key={key} type="button" className={`ptab${resTab === key ? " on" : ""}`} onClick={() => setResTab(key)}><MatrixIcon size={14}>{icons[icon]}</MatrixIcon>{label}</button>
            ))}
          </div>
          <textarea className="paste-text tall" value={result} onChange={(event) => setResult(event.target.value)} placeholder={placeholder} />
          <div className="paste-hint">Include files changed, commands run, test results, and notes.</div>
          <div className="paste-actions">
            <button className="bo-btn primary" type="button" onClick={runValidation}><MatrixIcon size={16}>{icons.check}</MatrixIcon>Check AI output</button>
            <button className="bo-btn" type="button" onClick={onBack}>Cancel</button>
          </div>
        </article>
        <div className="upd-note reveal"><MatrixIcon size={15}>{icons.shield}</MatrixIcon>We&apos;ll validate the output and update the batch status.</div>
      </div>
    </div>
  );
}

// Run log — streams the live validation run (real findings from the API, streamed line by line).
// The DB-backed async run (enqueueRun/WS) is a later, paid-storage feature; this drives the same
// terminal UX from the stateless validation call so the user watches the contract check happen.
type LogLine = { t: string; cls?: "ok" | "bad" | "warn" | "dim" };

function RunLog({
  report,
  failed,
  coder,
  batchN,
  changedCount,
  showToast,
  onNew,
  onComplete,
}: {
  report: ValidationReportContract | null;
  failed: boolean;
  coder: CoderId;
  batchN: string;
  changedCount: number;
  showToast: (message: string) => void;
  onNew: () => void;
  onComplete: () => void;
}) {
  const coderEntry = AI_CODERS.find((item) => item.id === coder) ?? AI_CODERS[1];
  const queue = useRef<LogLine[]>([]);
  const enqueuedResult = useRef(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [done, setDone] = useState(false);

  // The streamer drains one queued line at a time so the log "types" itself.
  useEffect(() => {
    const id = setInterval(() => {
      setLines((cur) => (queue.current.length ? [...cur, queue.current.shift() as LogLine] : cur));
    }, 300);
    return () => clearInterval(id);
  }, []);

  // Preamble on mount.
  useEffect(() => {
    queue.current = [
      { t: `$ matrix run --batch ${batchN} --coder ${coderEntry.short}` },
      { t: "▸ connecting to the Matrix validator …", cls: "dim" },
      { t: "▸ loading contract: MATRIX_STANDARDS.lock · MATRIX_ALLOWED_CHANGES.md", cls: "dim" },
      { t: `▸ submitting ${changedCount} changed file(s) from your AI coder …`, cls: "dim" },
      { t: "▸ checking the patch against the build contract …", cls: "dim" },
    ];
    setLines([]);
  }, [batchN, changedCount, coderEntry.short]);

  // When the real report (or failure) lands, enqueue the real check lines + outcome, then finish.
  useEffect(() => {
    if (enqueuedResult.current) return undefined;
    if (!report && !failed) return undefined;
    enqueuedResult.current = true;

    if (!report) {
      queue.current.push({ t: "✗ validator unreachable — could not complete the run", cls: "bad" });
      queue.current.push({ t: "MATRIX_STATUS: error", cls: "bad" });
    } else {
      for (const c of report.checks) {
        queue.current.push({
          t: `${c.status === "passed" ? "✓" : c.status === "skipped" ? "•" : "✗"} ${c.check_id}${c.message ? ` — ${c.message}` : ""}`,
          cls: c.status === "passed" ? "ok" : c.status === "skipped" ? "dim" : "bad",
        });
      }
      for (const v of report.violations) {
        queue.current.push({ t: `  ✗ ${v.rule_id}: ${v.message}`, cls: "bad" });
      }
      const label = report.status === "approved" ? "approved" : report.status === "needs-repair" ? "needs_repair" : "rejected";
      queue.current.push({
        t: `MATRIX_STATUS: ${label}  score=${report.score}`,
        cls: report.status === "approved" ? "ok" : report.status === "needs-repair" ? "warn" : "bad",
      });
    }

    const drain = setInterval(() => {
      if (queue.current.length === 0) {
        clearInterval(drain);
        setTimeout(() => setDone(true), 500);
      }
    }, 200);
    return () => clearInterval(drain);
  }, [report, failed]);

  return (
    <div className="mb-dark-page">
      <header className="mb-detail-bar"><div className="l-wrap dbar-in">
        <a href="/matrix-builder" className="l-brand"><span className="gl">◇</span>Matrix Builder</a>
        <div className="dbar-r" style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <button className="l-newbuild" type="button" onClick={onNew}><MatrixIcon size={15}>{icons.plus}</MatrixIcon>New build</button>
          <AuthControls onNotice={showToast} />
        </div>
      </div></header>

      <div className="l-wrap val">
        <h1 className="val-h1 reveal">Running validation</h1>
        <p className="upd-sub reveal">Checking the AI coder&apos;s changes against the build contract — live.</p>

        <article className="darkpanel runlog reveal" aria-live="polite">
          <div className="runlog-bar"><span className="runlog-dots"><i /><i /><i /></span><span className="runlog-k">matrix · batch {batchN}</span></div>
          <pre className="runlog-body">
            {lines.map((line, i) => (
              <span key={i} className={`rl ${line.cls ?? ""}`}>{line.t}{"\n"}</span>
            ))}
            {!done && <span className="rl-cursor">▋</span>}
          </pre>
        </article>

        <div className="val-actions reveal">
          <button className="bo-btn primary" type="button" disabled={!done} onClick={onComplete}>
            {done ? <>View validation result <MatrixIcon size={16}>{icons.arrow}</MatrixIcon></> : <>Running…</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// Validation-result page — shows the real contract result (approved / needs-repair / rejected),
// the real findings, and the Matrix Commit on success.
function ValidationResult({
  batchIndex,
  coder,
  report,
  commitId,
  explanation,
  showToast,
  onNew,
  onBack,
  onTimeline,
  onContinue,
  onFinish,
  onRepair,
}: {
  batchIndex: number;
  coder: CoderId;
  report: ValidationReportContract | null;
  commitId: string;
  explanation: string | null;
  showToast: (message: string) => void;
  onNew: () => void;
  onBack: () => void;
  onTimeline: () => void;
  onContinue: () => void;
  onFinish: () => void;
  onRepair: () => void;
}) {
  const cur = STAGES[batchIndex];
  const coderEntry = AI_CODERS.find((item) => item.id === coder) ?? AI_CODERS[1];
  const isLast = batchIndex >= STAGES.length - 1;
  const nextN = STAGES[batchIndex + 1]?.n ?? "";
  const status = report?.status ?? "rejected";
  const passed = status === "approved";
  const score = report?.score ?? 0;
  // Real findings: the failing checks and explicit violations the engine returned.
  const findings = [
    ...(report?.violations ?? []).map((v) => ({ key: v.rule_id, label: v.rule_id, message: v.message, remediation: v.remediation ?? null })),
    ...(report?.checks ?? []).filter((c) => c.status === "failed").map((c) => ({ key: c.check_id, label: c.check_id, message: c.message ?? "Check failed.", remediation: null })),
  ];
  const heroClass = passed ? "passed" : status === "needs-repair" ? "repair" : "rejected";
  const title = passed ? `Batch ${cur.n} passed` : status === "needs-repair" ? `Batch ${cur.n} needs repair` : `Batch ${cur.n} rejected`;
  const note = passed
    ? `Matrix Commit ${commitId} created. The AI coder followed the contract.`
    : `The AI coder's changes did not satisfy the contract (score ${score}/100). Fix the findings and resubmit.`;

  return (
    <div className="mb-dark-page">
      <header className="mb-detail-bar"><div className="l-wrap dbar-in">
        <a href="/matrix-builder" className="l-brand"><span className="gl">◇</span>Matrix Builder</a>
        <div className="dbar-r" style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <button className="l-newbuild" type="button" onClick={onNew}><MatrixIcon size={15}>{icons.plus}</MatrixIcon>New build</button>
          <AuthControls onNotice={showToast} />
        </div>
      </div></header>

      <div className="l-wrap val">
        <button className="upd-back reveal" type="button" onClick={onBack}><MatrixIcon size={15}>{icons.back}</MatrixIcon>Batch {cur.n}</button>
        <h1 className="val-h1 reveal">Validation Result</h1>
        <p className="upd-sub reveal">Check if the AI coder followed the contract.</p>

        <article className={`val-hero ${heroClass} reveal`}>
          <span className={`vh-ic ${passed ? "ok" : "bad"}`}><MatrixIcon size={30}>{passed ? icons.check : icons.shield}</MatrixIcon></span>
          <div><div className="vh-title">{title}</div><div className="vh-note">{note}</div></div>
        </article>

        <article className="darkpanel val-info reveal">
          <div className="vi-row"><span className="vi-k"><MatrixIcon size={16}>{icons.cpu}</MatrixIcon>AI coder used</span><span className="vi-v"><span className="vi-chip">{coderEntry.short}</span></span></div>
          <div className="vi-row"><span className="vi-k"><MatrixIcon size={16}>{icons.check}</MatrixIcon>Validation</span><span className="vi-v">{passed ? <span className="vi-pass"><MatrixIcon size={14}>{icons.check}</MatrixIcon>Passed · {score}/100</span> : <span className="vstate rejected on">{status} · {score}/100</span>}</span></div>
          <div className="vi-row"><span className="vi-k"><MatrixIcon size={16}>{icons.bundles}</MatrixIcon>Matrix Commit</span><span className="vi-v mono-chip">{passed ? commitId : "—"}</span></div>
        </article>

        {!passed && findings.length > 0 && (
          <article className="darkpanel val-findings reveal">
            <div className="vf-h"><MatrixIcon size={16}>{icons.shield}</MatrixIcon>Findings ({findings.length})</div>
            {findings.map((f) => (
              <div className="vf-row" key={f.key}>
                <span className="vf-rule">{f.label}</span>
                <span className="vf-msg">{f.message}{f.remediation ? ` — ${f.remediation}` : ""}</span>
              </div>
            ))}
          </article>
        )}

        {/* Optional Internal AI: plain-language helper copy. The status/score/findings above are
            the deterministic validator's and are never changed by this text. */}
        {explanation && (
          <article className="val-ai-explain reveal">
            <div className="vae-h"><MatrixIcon size={14}>{icons.cpu}</MatrixIcon>AI explanation (assist)</div>
            {explanation}
          </article>
        )}

        <div className="val-actions reveal">
          {passed
            ? (isLast
                ? <button className="bo-btn primary" type="button" onClick={onFinish}><MatrixIcon size={17}>{icons.check}</MatrixIcon>Finish build</button>
                : <button className="bo-btn primary" type="button" onClick={onContinue}><MatrixIcon size={16}>{icons.plus}</MatrixIcon>Generate Batch {nextN}</button>)
            : <button className="bo-btn primary" type="button" onClick={onRepair}><MatrixIcon size={16}>{icons.refresh}</MatrixIcon>Fix &amp; resubmit</button>}
          <button className="bo-btn" type="button" onClick={onTimeline}><MatrixIcon size={16}>{icons.clock}</MatrixIcon>View timeline</button>
        </div>
        {passed && !isLast && <div className="val-tertiary reveal"><button className="val-tlink" type="button" onClick={onFinish}>Finish build early</button></div>}
      </div>
    </div>
  );
}

// Build Timeline — the dark, in-flow timeline of passed batches for the current build.
// Reached from "View timeline"; "back" returns to the active build screen (state preserved).
function BuildTimeline({
  buildName,
  buildId,
  passed,
  showToast,
  onNew,
  onBack,
  onContinue,
}: {
  buildName: string;
  buildId: string;
  passed: number;
  showToast: (message: string) => void;
  onNew: () => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const batches = timelineBatches(passed);
  return (
    <div className="mb-dark-page">
      <header className="mb-detail-bar"><div className="l-wrap dbar-in">
        <a href="/matrix-builder" className="l-brand"><span className="gl">◇</span>Matrix Builder</a>
        <div className="dbar-r" style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <button className="l-newbuild" type="button" onClick={onNew}><MatrixIcon size={15}>{icons.plus}</MatrixIcon>New build</button>
          <AuthControls onNotice={showToast} />
        </div>
      </div></header>

      <div className="l-wrap tl">
        <button className="upd-back reveal" type="button" onClick={onBack}><MatrixIcon size={15}>{icons.back}</MatrixIcon>{prettyName(buildName)}</button>
        <h1 className="tl-h1 reveal">Build Timeline</h1>
        <p className="upd-sub reveal">Prompts, batches, checks, and feedback.</p>

        {batches.length ? (
          <div className="tl-list stag">
            {batches.map((batch, i) => (
              <div className="tl-row" key={batch.n}>
                <div className="tl-rail">
                  <span className="tl-node ok"><MatrixIcon size={15}>{icons.check}</MatrixIcon></span>
                  {i < batches.length - 1 && <span className="tl-line" />}
                </div>
                <article className="darkpanel tl-card">
                  <div className="tl-thumb"><BundleThumbnail seed={buildId + batch.n} /></div>
                  <div className="tl-body">
                    <div className="tl-title">Batch {batch.n} — {batch.title}</div>
                    <div className="tl-commit">Matrix Commit {batch.commit} <span className="tl-dot">·</span> <span className="tl-pass">Passed</span></div>
                    <div className="tl-meta">{batch.meta.map((m, j) => <span key={m}>{j > 0 && <span className="tl-dot">·</span>} {m} </span>)}</div>
                  </div>
                  <div className="tl-actions">
                    <button className="tl-view" type="button" onClick={() => showToast(`Matrix Commit ${batch.commit} — followed the contract`)}>View details <MatrixIcon size={15}>{icons.chevR}</MatrixIcon></button>
                  </div>
                </article>
              </div>
            ))}
          </div>
        ) : (
          <div className="lib-empty reveal in">
            <div className="le-mark">◇</div>
            <div className="le-t">No batches yet</div>
            <div className="le-d">Run a batch through validation and it will appear here.</div>
          </div>
        )}

        <div className="tl-cta reveal"><button className="bo-btn primary lg" type="button" onClick={onContinue}>Continue build <MatrixIcon size={17}>{icons.arrow}</MatrixIcon></button></div>
      </div>
    </div>
  );
}

// Build-complete report page — every batch passed; offer to reopen, view the timeline, or finish.
function BuildComplete({
  candidate,
  batchesPassed,
  showToast,
  onNew,
  onReopen,
  onTimeline,
  onMyBuilds,
}: {
  candidate: BlueprintCandidate;
  batchesPassed: number;
  showToast: (message: string) => void;
  onNew: () => void;
  onReopen: () => void;
  onTimeline: () => void;
  onMyBuilds: () => void;
}) {
  return (
    <div className="mb-dark-page">
      <header className="mb-detail-bar"><div className="l-wrap dbar-in">
        <a href="/matrix-builder" className="l-brand"><span className="gl">◇</span>Matrix Builder</a>
        <div className="dbar-r" style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
          <button className="l-newbuild" type="button" onClick={onNew}><MatrixIcon size={15}>{icons.plus}</MatrixIcon>New build</button>
          <AuthControls onNotice={showToast} />
        </div>
      </div></header>

      <div className="l-wrap bcp">
        <div className="bcp-hero reveal">
          <span className="bcp-orb"><span className="bcp-ring" /><MatrixIcon size={42}>{icons.check}</MatrixIcon></span>
          <div className="bcp-k">Build complete</div>
          <h1 className="bcp-h1">{candidate.name}<br /><span className="bcp-em">is ready.</span></h1>
          <p className="bcp-sub">Every batch passed validation. Your project was built one safe batch at a time — fully under contract.</p>
        </div>

        <div className="bcp-stats reveal">
          <div className="bcp-stat"><div className="bcp-sv">{batchesPassed}</div><div className="bcp-sl">Batches passed</div></div>
          <div className="bcp-stat"><div className="bcp-sv">v1.0.0</div><div className="bcp-sl">Version</div></div>
          <div className="bcp-stat"><div className="bcp-sv">100%</div><div className="bcp-sl">Contract met</div></div>
        </div>

        <div className="bcp-actions reveal">
          <button className="bo-btn primary lg" type="button" onClick={onReopen}><MatrixIcon size={17}>{icons.refresh}</MatrixIcon>Reopen &amp; keep building</button>
          <button className="bo-btn lg" type="button" onClick={onTimeline}><MatrixIcon size={16}>{icons.clock}</MatrixIcon>View timeline</button>
        </div>
        <div className="val-tertiary reveal">
          <button className="val-tlink grn" type="button" onClick={onMyBuilds}>Back to My Builds</button>
          <span className="val-tsep" />
          <button className="val-tlink" type="button" onClick={() => showToast("Bundle download started")}>Download bundle</button>
        </div>
      </div>
    </div>
  );
}

export default function MatrixBuilderClient({ initialBuild }: { initialBuild?: InitialBuild } = {}) {
  // When reopened from My Builds we land directly on the active build screen, reconstructed
  // from the persisted build, so the user keeps full context (no state is lost).
  const [phase, setPhase] = useState<Phase>(initialBuild ? "bundle" : "hero");
  const [idea, setIdea] = useState(initialBuild?.idea ?? "");
  const [scanIndex, setScanIndex] = useState(0);
  const [candidates, setCandidates] = useState<BlueprintCandidate[]>([]);
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);
  // Optional Internal AI: display-only copy overrides keyed by candidate id; the deterministic
  // candidate objects (used for bundle generation) are never mutated. Empty unless assist is on.
  const [enrichedById, setEnrichedById] = useState<EnrichmentMap>({});
  // Optional Internal AI: plain-language explanation of the (authoritative) validation result.
  const [validationExplanation, setValidationExplanation] = useState<string | null>(null);
  const [chosen, setChosen] = useState<BlueprintCandidate | null>(initialBuild?.candidate ?? null);
  const [bundleId, setBundleId] = useState(initialBuild?.bundleId ?? "");
  // The real engine bundle + its file manifest (what the UI shows / downloads). Generation is async.
  const [bundle, setBundle] = useState<MatrixBundleContract | null>(null);
  const [bundleFiles, setBundleFiles] = useState<BundleFile[]>([]);
  const [bundleLoading, setBundleLoading] = useState(false);
  const [promptText, setPromptText] = useState("");
  const [promptLoading, setPromptLoading] = useState(false);
  // Real validation of a submitted batch (stateless; see workflow-client.validateChanges).
  const [validation, setValidation] = useState<ValidationReportContract | null>(null);
  const [validationFailed, setValidationFailed] = useState(false);
  const [changedFiles, setChangedFiles] = useState<ChangedPath[]>([]);
  const [commitId, setCommitId] = useState("");
  const [batchIndex, setBatchIndex] = useState(initialBuild?.batchIndex ?? 0);
  const [passed, setPassed] = useState(initialBuild?.passed ?? 0);
  const [coder, setCoder] = useState<CoderId>(initialBuild?.coder ?? "claude-code");
  const [toast, setToast] = useState<string | null>(null);
  const [animationSafe, setAnimationSafe] = useState(false);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    setAnimationSafe(false);
    const timeout = setTimeout(() => setAnimationSafe(true), 1800);
    return () => clearTimeout(timeout);
  }, [phase]);

  // No silent fallback to an example: an empty idea yields "" and Generate stays disabled.
  const effectiveIdea = idea.trim();

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2600);
  };

  // "Upload existing plan" (Batches 4–6). Routing handlers are defined below, after generate/goPhase.
  const [uploadOpen, setUploadOpen] = useState(false);
  const [brief, setBrief] = useState<ProjectBriefContract | null>(null);
  // Step-1 control row: edit the idea + regenerate before committing to a build.
  const [editingIdea, setEditingIdea] = useState(false);
  const [ideaDraft, setIdeaDraft] = useState("");
  // The big heading shows a short subject only — a brief's title, or a clamped idea. Never the
  // full folded brief/template text (which belongs in the "Project understood" card).
  const headingRaw = (brief?.title?.trim() || effectiveIdea);
  const headingSubject = headingRaw.length > 70 ? `${headingRaw.slice(0, 67).trimEnd()}…` : headingRaw;
  // What created the current cards (shown as a quiet pill in the Step-1 control row).
  const sourceLabel = brief
    ? (brief.source_type === "template" ? "Template" : brief.source_type === "design" ? "Design" : "Brief")
    : "Idea";
  // Edit the idea inline, then regenerate the three options before committing.
  const startEditIdea = () => { setIdeaDraft(idea || headingSubject); setEditingIdea(true); };
  const regenerate = () => {
    const text = (editingIdea ? ideaDraft : idea).trim();
    if (!text) return;
    if (editingIdea) { setIdea(text); setBrief(null); setEditingIdea(false); } // user took manual control
    generate(text);
  };

  // Step 1 — ask the engine to normalize the idea and return its three real candidates. The
  // scanning screen is the loading state; if the engine is unreachable we fall back to the
  // deterministic offline generator so the demo still works.
  const generate = (ideaOverride?: string) => {
    // Empty-input guard: never silently build from a fallback example. `ideaOverride` lets the
    // upload/template paths feed their derived idea without waiting for setIdea to settle.
    const ideaText = (ideaOverride ?? idea).trim();
    if (!ideaText) return;
    setCandidates([]);
    setCandidatesLoaded(false);
    setEnrichedById({});
    setScanIndex(0);
    setPhase("scanning");
    window.scrollTo({ top: 0, behavior: "smooth" });
    void (async () => {
      let list: BlueprintCandidate[];
      try {
        await parseIdea({ idea: ideaText }).catch(() => undefined); // best-effort normalize
        const result = await getBlueprintCandidates({ idea: ideaText });
        list = toUiCandidates(result.candidates);
      } catch {
        list = createBlueprintCandidates(ideaText); // offline fallback
      }
      setCandidates(list);
      setCandidatesLoaded(true);
      // Optional Internal AI assist (fail-open): improve display copy only, after candidates show.
      void enrichBlueprintCandidates(
        ideaText,
        list.map((c) => ({ id: c.id, tier: c.tier, name: c.name, summary: c.summary })),
      )
        .then((map) => setEnrichedById(map))
        .catch(() => undefined);
    })();
  };

  useEffect(() => {
    if (phase !== "scanning") return undefined;
    if (scanIndex >= SCANNING_MESSAGES.length) {
      // Hold on the last scan message until the engine's candidates have actually arrived.
      if (!candidatesLoaded) return undefined;
      const timeout = setTimeout(() => setPhase("candidates"), 380);
      return () => clearTimeout(timeout);
    }
    const timeout = setTimeout(() => setScanIndex((current) => current + 1), scanIndex === 0 ? 420 : 360);
    return () => clearTimeout(timeout);
  }, [phase, scanIndex, candidatesLoaded]);

  // Step 2 — generate the chosen candidate's Matrix Bundle on the engine (the real file manifest).
  const choose = (candidate: BlueprintCandidate) => {
    const localId = generateBundleId();
    setChosen(candidate);
    setBatchIndex(0);
    setPassed(0);
    setBundle(null);
    setBundleFiles([]);
    setBundleId("");
    setBundleLoading(true);
    setPhase("bundle");
    window.scrollTo({ top: 0, behavior: "smooth" });
    void (async () => {
      let resolvedId = localId;
      try {
        const real = await apiGenerateBundle({ idea: effectiveIdea }, coder, candidate.candidate_id);
        setBundle(real);
        setBundleFiles(toUiBundleFiles(real));
        resolvedId = real.bundle_id;
      } catch {
        setBundleFiles(createBundleFiles(effectiveIdea, candidate, localId)); // offline fallback
      } finally {
        setBundleId(resolvedId);
        setBundleLoading(false);
        // Persist so the build is openable from My Builds; the id is the engine's bundle id.
        saveBuildProgress({ id: resolvedId, name: candidate.name, description: candidate.summary, files: candidate.files, stack: candidate.stack, coder, passed: 0, status: "draft", idea: effectiveIdea, candidateId: candidate.id });
      }
    })();
  };

  // Reopened from My Builds: fetch the persisted bundle so the file manifest is the engine's.
  useEffect(() => {
    if (!initialBuild) return undefined;
    let cancelled = false;
    setBundleLoading(true);
    void (async () => {
      try {
        const real = await getBundle(initialBuild.bundleId);
        if (!cancelled) {
          setBundle(real);
          setBundleFiles(toUiBundleFiles(real));
        }
      } catch {
        if (!cancelled) setBundleFiles(createBundleFiles(initialBuild.idea, initialBuild.candidate, initialBuild.bundleId));
      } finally {
        if (!cancelled) setBundleLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialBuild]);

  // The prompt preview is the engine's controlled coder prompt for this bundle; it refetches when
  // the coder changes. Falls back to the local batch prompt when there's no real bundle (offline).
  useEffect(() => {
    if (phase !== "bundle" || !chosen) return undefined;
    let cancelled = false;
    setPromptLoading(true);
    // While the bundle is still generating we have no id yet — keep the skeleton up rather than
    // flashing the offline fallback; the effect reruns once bundleId resolves.
    if (!bundleId && bundleLoading) return undefined;
    void (async () => {
      let text = "";
      try {
        if (!bundleId) throw new Error("no bundle yet");
        const pack = await getBundlePrompt(bundleId, coder);
        text = pack.prompt;
      } catch {
        const coderEntry = AI_CODERS.find((item) => item.id === coder) ?? AI_CODERS[1];
        text = batchPrompt(coderEntry.name, chosen.name, STAGES[batchIndex], coder === "generic-ai-coder");
      }
      if (!cancelled) {
        setPromptText(text);
        setPromptLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, bundleId, coder, chosen, batchIndex, bundleLoading]);

  // Record build progress to the signed-in user's private store (localStorage).
  const persistBuild = (passedCount: number, status: BuildStatus) => {
    if (!chosen || !bundleId) return;
    saveBuildProgress({ id: bundleId, name: chosen.name, description: chosen.summary, files: chosen.files, stack: chosen.stack, coder, passed: passedCount, status, idea: effectiveIdea, candidateId: chosen.id });
  };

  // Save a Blob to disk via a transient anchor (used by the bundle download).
  const saveBlob = (blob: Blob, filename: string) => {
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      URL.revokeObjectURL(anchor.href);
      anchor.remove();
    }, 1500);
  };

  // Download the engine's bundle zip (byte-for-byte the CLI's bundle); fall back to building a zip
  // from the local manifest only when there's no real engine bundle.
  const downloadBundle = async () => {
    if (!chosen) return;
    if (bundleId && bundle) {
      try {
        const blob = await downloadBundleZip(bundleId);
        saveBlob(blob, `${chosen.name}-matrix-bundle.zip`);
        showToast("ZIP downloaded — open README.md first");
        return;
      } catch {
        // fall through to the offline zip below
      }
    }
    const files = bundleFiles.length ? bundleFiles : createBundleFiles(effectiveIdea, chosen, bundleId);
    saveBlob(makeZip(files), `${chosen.name}-matrix-bundle.zip`);
    showToast("ZIP downloaded — open README.md first");
  };

  // In-scope source/test files from the engine's manifest — the default change set to validate when
  // the user doesn't paste explicit paths (keeps the hello-world demo a one-click pass).
  const ALLOWED_ROOTS = ["frontend/", "backend/", "worker/", "tests/"];
  const fallbackFiles = (() => {
    const candidates = bundleFiles
      .map((f) => f.name)
      .filter((name) => ALLOWED_ROOTS.some((root) => name.startsWith(root)) && !name.split("/").pop()?.startsWith("MATRIX_"));
    return candidates.slice(0, 3).length ? candidates.slice(0, 3) : ["backend/app/main.py"];
  })();

  // "Check AI output" — validate the submitted changes against the contract (real findings),
  // stream the run, then show the Validation Result.
  const runValidation = (changed: ChangedPath[]) => {
    setChangedFiles(changed);
    setValidation(null);
    setValidationFailed(false);
    setValidationExplanation(null);
    setCommitId("");
    goPhase("running");
    void (async () => {
      try {
        const report = await validateChanges(bundleId, changed);
        setValidation(report);
        if (report.status === "approved") setCommitId(deriveCommitId(report));
        // Optional Internal AI assist (fail-open): explain the deterministic result in plain words.
        // The status/score/findings shown to the user always come from the validator above.
        void explainValidationFindings({
          status: report.status,
          score: report.score ?? 0,
          findings: [
            ...(report.violations ?? []).map((v) => ({ label: v.rule_id, message: v.message })),
            ...(report.checks ?? []).filter((c) => c.status === "failed").map((c) => ({ label: c.check_id, message: c.message ?? "Check failed." })),
          ],
        })
          .then((text) => setValidationExplanation(text))
          .catch(() => undefined);
      } catch {
        setValidationFailed(true);
      }
    })();
  };

  const goPhase = (next: Phase) => {
    setPhase(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const reset = () => {
    setPhase("hero");
    setChosen(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // "New build" — start over. When viewing a reopened build (its own URL), go to the builder
  // landing; during the in-page creation flow, just reset to the hero.
  const startNewBuild = () => {
    if (initialBuild) router.push("/matrix-builder");
    else reset();
  };

  // --- Import existing plan (Batches 4–6) ---------------------------------------------------
  // Path B: a document → deterministic ProjectBrief → same three tiers (fitted).
  const handleDocument = async (file: File) => {
    showToast("Reading your brief…");
    try {
      const resp = await ingestDocument(file);
      let brief = resp.brief;
      let ideaText = resp.idea;
      // Seam 1 (Batch 7) — optional OllaBridge enhancement for signed-in users; fail-open.
      if (isOllaBridgeAssistAvailable()) {
        const enhanced = await enhanceProjectBrief(brief);
        if (enhanced.enhanced_by === "ollabridge") {
          brief = enhanced;
          ideaText = briefToIdea(enhanced);
        }
      }
      setBrief(brief);
      setIdea(ideaText);
      showToast(brief.enhanced_by === "ollabridge" ? "Project brief detected · AI-assisted" : "Project brief detected");
      generate(ideaText);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't read that file.");
    }
  };

  // Path C: a complete blueprint compiles verbatim (AI skipped) → straight to the bundle.
  const buildFromBlueprint = async (bp: unknown) => {
    const b = _rec(bp);
    setBrief(null);
    setChosen(syntheticCandidate(b));
    setBatchIndex(0);
    setPassed(0);
    setBundle(null);
    setBundleFiles([]);
    setBundleId("");
    setBundleLoading(true);
    goPhase("bundle");
    try {
      const real = await generateBundleFromBlueprint(bp, coder);
      setBundle(real);
      setBundleFiles(toUiBundleFiles(real));
      setBundleId(real.bundle_id);
      saveBuildProgress({
        id: real.bundle_id,
        name: typeof b.name === "string" ? b.name : "Imported blueprint",
        description: typeof b.idea === "string" ? b.idea : "User-provided blueprint",
        files: _strs(b.required_files).length || toUiBundleFiles(real).length,
        stack: _strs(Object.values(_rec(b.stack))),
        coder,
        passed: 0,
        status: "draft",
        idea: typeof b.idea === "string" ? b.idea : (typeof b.name === "string" ? b.name : "blueprint"),
        candidateId: "standard",
      });
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't compile the blueprint.");
    } finally {
      setBundleLoading(false);
    }
  };

  const handleBlueprintJson = async (file: File) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      showToast("That file isn't valid JSON.");
      return;
    }
    showToast("Validating blueprint…");
    try {
      const res = await importBlueprint(parsed);
      if (res.valid && res.blueprint) {
        showToast("Blueprint JSON detected — AI skipped.");
        void buildFromBlueprint(res.blueprint);
        return;
      }
      // Not a complete blueprint (e.g. a lightweight template) — treat as a brief if possible.
      const derived = objToIdea(_rec(parsed));
      if (derived) {
        setIdea(derived);
        showToast("Imported as a brief");
        generate(derived);
      } else {
        showToast(res.errors?.[0] ?? "That JSON isn't a complete blueprint.");
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Blueprint import failed.");
    }
  };

  const onUploadContinue = (sel: UploadSelection) => {
    setUploadOpen(false);
    if (!sel.file) return;
    const name = sel.file.name.toLowerCase();
    if (name.endsWith(".json")) void handleBlueprintJson(sel.file);
    else void handleDocument(sel.file); // pdf/docx/md/txt
  };

  // Batch 6: "Use template" → fetch the generic template → fold into an idea → same three tiers.
  const onUseTemplate = (id: TemplateId) => {
    setUploadOpen(false);
    showToast("Loading template…");
    void (async () => {
      try {
        const tpl = await fetchTemplate(id);
        // Structured brief: the SHORT title drives the heading; details go to the
        // "Project understood" card. The folded idea string is sent only to the engine.
        setBrief({
          schema_version: "matrix.builder.brief/v1",
          source_type: "template",
          title: tpl.name,
          summary: tpl.summary,
          domain: null,
          goals: tpl.goals ?? [],
          users: [],
          features: tpl.features ?? [],
          screens: [],
          integrations: [],
          constraints: [],
          risks: [],
          non_functional: tpl.non_functional_requirements ?? [],
          source_files: [],
          enhanced_by: "deterministic",
        });
        const ideaText = templateToIdea(tpl);
        setIdea(ideaText);
        generate(ideaText);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Couldn't load that template.");
      }
    })();
  };

  return (
    <div className={`app${animationSafe ? " anim-safe" : ""}`}>
      <UploadExistingPlanModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onContinue={onUploadContinue}
        onUseTemplate={onUseTemplate}
      />
      {phase === "hero" && <LandingHero idea={idea} setIdea={setIdea} generate={generate} onUpload={() => setUploadOpen(true)} />}

      {phase === "scanning" && (
        <>
          <BuilderBar onNew={reset} onNotice={showToast} />
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
          <BuilderBar onNew={reset} onNotice={showToast} />
          <div className="l-wrap mb-page">
            <div className="mb-head reveal">
              <span className="mb-eyebrow"><span className="d" />Step 1 · Choose a blueprint</span>
              <h2 className="mb-h2">Three controlled ways<br />to build <em>{headingSubject.toLowerCase()}</em>.</h2>
              <div className="mb-srcrow reveal">
                <span className="mb-src-pill">{sourceLabel}</span>
                {editingIdea ? (
                  <input
                    className="mb-src-edit"
                    value={ideaDraft}
                    autoFocus
                    onChange={(e) => setIdeaDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") regenerate(); else if (e.key === "Escape") setEditingIdea(false); }}
                    aria-label="Edit idea"
                  />
                ) : (
                  <button className="mb-src-idea" type="button" onClick={startEditIdea} title="Edit the idea">
                    <span className="mb-src-text">{headingSubject}</span>
                    <MatrixIcon size={13}>{icons.edit}</MatrixIcon>
                  </button>
                )}
                {isOllaBridgeAssistAvailable() && (
                  <span className="mb-src-ai" title="OllaBridge helped understand the input. Matrix Builder still controls the contract.">AI assist <MatrixIcon size={12}>{icons.info}</MatrixIcon></span>
                )}
                <button className="mb-src-regen" type="button" onClick={regenerate} title="Regenerate the three options"><MatrixIcon size={14}>{icons.refresh}</MatrixIcon>Regenerate</button>
              </div>
              <p className="mb-sub">Every candidate ships with locked standards and a build contract. Pick the one that fits your scope.</p>
              <button className="l-upload-link" type="button" onClick={() => setUploadOpen(true)} aria-label="Upload a brief, blueprint, design, or JSON" title="Upload a brief, blueprint, design, or JSON">
                <MatrixIcon size={15}>{icons.plug}</MatrixIcon>Attach
              </button>
            </div>
            {brief && (
              <details className="brief-card reveal" open>
                <summary>
                  <span className="brief-k">Project understood</span>
                  {brief.enhanced_by === "ollabridge" && <span className="brief-ai">✦ AI-assisted understanding</span>}
                </summary>
                <div className="brief-body">
                  <div className="brief-t">{brief.title}</div>
                  <p className="brief-sum">{brief.summary}</p>
                  {brief.features.length > 0 && (
                    <div className="brief-tags">{brief.features.slice(0, 6).map((f) => <span key={f} className="brief-tag">{f}</span>)}</div>
                  )}
                </div>
              </details>
            )}
            <div className="cand-grid stag">
              {candidates.map((candidate) => <CandidateCard key={candidate.id} candidate={candidate} choose={choose} enrichment={enrichedById[candidate.id]} />)}
            </div>
          </div>
        </>
      )}

      {phase === "bundle" && chosen && (
        <BundleResult
          candidate={chosen}
          batchIndex={batchIndex}
          coder={coder}
          setCoder={setCoder}
          prompt={promptText}
          promptLoading={promptLoading}
          bundleLoading={bundleLoading}
          fileCount={bundleFiles.length}
          showToast={showToast}
          onNew={startNewBuild}
          onMyBuilds={() => router.push("/matrix-builder/builds")}
          onSubmit={() => goPhase("submit")}
          onTimeline={() => goPhase("timeline")}
          onDownload={() => void downloadBundle()}
        />
      )}

      {phase === "submit" && chosen && (
        <SubmitResult
          batchIndex={batchIndex}
          fallbackFiles={fallbackFiles}
          showToast={showToast}
          onNew={startNewBuild}
          onBack={() => goPhase("bundle")}
          onValidate={runValidation}
        />
      )}

      {phase === "running" && chosen && (
        <RunLog
          report={validation}
          failed={validationFailed}
          coder={coder}
          batchN={STAGES[batchIndex].n}
          changedCount={changedFiles.length}
          showToast={showToast}
          onNew={startNewBuild}
          onComplete={() => goPhase("validation")}
        />
      )}

      {phase === "validation" && chosen && (
        <ValidationResult
          batchIndex={batchIndex}
          coder={coder}
          report={validation}
          commitId={commitId}
          explanation={validationExplanation}
          showToast={showToast}
          onNew={startNewBuild}
          onBack={() => goPhase("submit")}
          onTimeline={() => goPhase("timeline")}
          onRepair={() => goPhase("submit")}
          onContinue={() => {
            const next = batchIndex + 1;
            setPassed(next);
            persistBuild(next, "ready");
            showToast(`Batch ${STAGES[batchIndex].n} passed — Matrix Commit ${commitId}`);
            setBatchIndex(Math.min(next, STAGES.length - 1));
            goPhase("bundle");
          }}
          onFinish={() => {
            const total = batchIndex + 1;
            setPassed(total);
            persistBuild(total, "validated");
            goPhase("complete");
          }}
        />
      )}

      {phase === "timeline" && chosen && (
        <BuildTimeline
          buildName={chosen.name}
          buildId={bundleId}
          passed={passed}
          showToast={showToast}
          onNew={startNewBuild}
          onBack={() => goPhase("bundle")}
          onContinue={() => goPhase("bundle")}
        />
      )}

      {phase === "complete" && chosen && (
        <BuildComplete
          candidate={chosen}
          batchesPassed={passed}
          showToast={showToast}
          onNew={startNewBuild}
          onReopen={() => {
            setBatchIndex((i) => Math.min(i + 1, STAGES.length - 1));
            goPhase("bundle");
          }}
          onTimeline={() => goPhase("timeline")}
          onMyBuilds={() => router.push("/matrix-builder/builds")}
        />
      )}

      {toast && <div className="mb-toast"><MatrixIcon size={17}>{icons.check}</MatrixIcon>{toast}</div>}
    </div>
  );
}
