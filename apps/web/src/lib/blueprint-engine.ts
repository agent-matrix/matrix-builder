// C1 — Browser blueprint-engine: deterministic, pure, no network.
//
// `generate(idea)` builds the initial blueprint; `apply(state, instruction)` is the local
// orchestrator that mutates the plan from a chat instruction (add / reduce / split batches,
// switch stack, add components) and returns the patched state + a reply + which sections
// changed. This is the primary path — the LLM (C3) only *refines* this result, optionally.

import {
  type ArchitectureNode,
  type BlueprintDetailsData,
  type BlueprintSection,
  type DesignerBatch,
  type DesignerCandidate,
  type FilePlanItem,
  RMD_RULES,
} from "@/types/blueprint-state";

type Domain = "web-game" | "api" | "web-app";
type Tier = { id: string; difficulty: string; scale: number };

const TIERS: Tier[] = [
  { id: "minimal", difficulty: "Easy", scale: 0.55 },
  { id: "standard", difficulty: "Medium", scale: 1.0 },
  { id: "production", difficulty: "Hard", scale: 1.6 },
];

// ---- generate -------------------------------------------------------------------------
export function generate(candidateId: string, idea: string): BlueprintDetailsData {
  const tier = TIERS.find((t) => t.id === candidateId) ?? TIERS[1];
  const domain = inferDomain(idea);
  const full = roadmap(domain);
  const n = Math.max(3, Math.round(full.length * tier.scale));
  const batches = n <= full.length ? full.slice(0, n) : full.concat(extra(full.length, n - full.length));
  return {
    candidate_id: candidateId,
    overview: `This ${candidateId} blueprint builds ${idea.trim().slice(0, 120)}. Delivered in ordered, validated batches.`,
    architecture: candidateId === "minimal" ? architecture(domain).slice(0, 2) : architecture(domain),
    batches,
    file_plan: filePlan(domain),
    matrix_rules: RMD_RULES,
    acceptance_criteria: ["builds and runs", "core flow works with tests", "Matrix validation approves the build"],
    validation_plan: ["lint", "typecheck", "unit tests", "allowed-file check", "Matrix commit check"],
    risks: ["external credentials may be required"],
    assumptions: [domain === "web-game" ? "original assets only" : "auth required if data is sensitive"],
    design_brain: `Client engine · ${batches.length} batches · ${candidateId}.`,
    chat_history: [],
  };
}

export function generateCandidates(idea: string): DesignerCandidate[] {
  const domain = inferDomain(idea);
  const stack = stackFor(domain);
  const meta: [string, string, string, string, boolean][] = [
    ["minimal", "Minimal", "Easy", "a weekend", false],
    ["standard", "Standard", "Medium", "about one week", true],
    ["production", "Production", "Hard", "about three weeks", false],
  ];
  return meta.map(([id, tier, difficulty, estimate, recommended]) => ({
    id, tier, difficulty, estimate, recommended, stack,
    title: `${tier} ${id === "standard" ? "Matrix Bundle" : "controlled blueprint"}`,
    summary: `${recommended ? "Recommended " : ""}controlled blueprint for: ${idea.trim().slice(0, 90)}`,
    file_count: generate(id, idea).batches.length * (id === "production" ? 7 : 5),
  }));
}

// ---- apply — the local orchestrator ---------------------------------------------------
export interface ApplyResult {
  data: BlueprintDetailsData;
  reply: string;
  updatedSections: BlueprintSection[];
}

export function apply(state: BlueprintDetailsData, instruction: string): ApplyResult {
  const text = instruction.trim();
  const m = text.toLowerCase();
  const data = clone(state);
  const sections = new Set<BlueprintSection>();
  let reply = "Noted. Save latest edits to keep this.";

  const nextId = () => `batch-${String(data.batches.length + 1).padStart(2, "0")}`;

  // 1) split a batch into two
  if (/\bsplit\b/.test(m)) {
    const idx = pickBatchIndex(data, m);
    if (idx >= 0) {
      const b = data.batches[idx];
      const partB: DesignerBatch = {
        ...clone(b), id: nextId(), name: `${b.name} (part 2)`, depends_on: [b.id],
      };
      data.batches[idx] = { ...b, name: `${b.name} (part 1)` };
      data.batches.splice(idx + 1, 0, partB);
      renumber(data);
      sections.add("batches");
      reply = `Split “${b.name}” into two batches. Review and Save latest edits.`;
      return finish(data, sections, reply);
    }
  }

  // 2) reduce / remove scope
  if (/\b(reduce|smaller|simpler|remove|drop|trim)\b/.test(m)) {
    if (data.batches.length > 3) {
      const dropped = data.batches.pop()!;
      sections.add("batches");
      reply = `Reduced scope — removed “${dropped.name}”.`;
    } else {
      reply = "Already at the minimal batch set.";
    }
    return finish(data, sections, reply);
  }

  // 3) switch stack / framework  (architecture + file plan)
  const stackHit = detectStack(m);
  if (stackHit) {
    applyStack(data, stackHit);
    sections.add("architecture");
    sections.add("filePlan");
    reply = `Switched to ${stackHit.label}. Updated architecture and file plan.`;
    return finish(data, sections, reply);
  }

  // 4) add an architecture component
  const comp = detectComponent(m);
  if (comp) {
    if (!data.architecture.some((n) => n.name === comp.name)) {
      data.architecture.push(comp);
      sections.add("architecture");
    }
    // also add a batch to build it
    data.batches.push(makeBatch(nextId(), comp.batchName, comp.allowed, text));
    renumber(data);
    sections.add("batches");
    reply = `Added ${comp.name} (architecture + a build batch).`;
    return finish(data, sections, reply);
  }

  // 5) add a feature / level / boss → a scoped batch
  if (/\b(add|include|introduce|boss|level|enemy|feature|analytic|metric|audit|auth|dashboard|observab)\b/.test(m)) {
    const name = featureName(m);
    data.batches.push(makeBatch(nextId(), name, ["src/**"], text));
    renumber(data);
    sections.add("batches");
    reply = `Added ${data.batches[data.batches.length - 1].id} — ${name}. Review and Save latest edits.`;
    return finish(data, sections, reply);
  }

  return finish(data, sections, reply);
}

// ---- helpers --------------------------------------------------------------------------
function finish(data: BlueprintDetailsData, sections: Set<BlueprintSection>, reply: string): ApplyResult {
  if (sections.has("batches")) {
    data.design_brain = `Client engine · ${data.batches.length} batches · ${data.candidate_id}.`;
    sections.add("designBrain");
  }
  return { data, reply, updatedSections: [...sections] };
}

function makeBatch(id: string, name: string, allowed: string[], from: string): DesignerBatch {
  return {
    id, name, purpose: `Added from chat: ${from}`, tasks: [from],
    allowed_files: allowed, depends_on: [], acceptance_criteria: ["feature works", "no runtime errors"],
    validation_checks: ["unit tests"], must_not_change: [],
  };
}

function renumber(data: BlueprintDetailsData): void {
  data.batches.forEach((b, i) => { b.id = `batch-${String(i + 1).padStart(2, "0")}`; });
}

function pickBatchIndex(data: BlueprintDetailsData, m: string): number {
  const num = m.match(/\b(\d{1,2})\b/);
  if (num) {
    const i = parseInt(num[1], 10) - 1;
    if (i >= 0 && i < data.batches.length) return i;
  }
  return data.batches.length - 1;
}

function featureName(m: string): string {
  if (/boss/.test(m)) return "Boss encounter";
  if (/level/.test(m)) return "Extra level";
  if (/analytic|metric/.test(m)) return "Analytics & metrics";
  if (/audit/.test(m)) return "Audit logging";
  if (/auth/.test(m)) return "Auth & access";
  if (/dashboard/.test(m)) return "Admin dashboard";
  if (/observab/.test(m)) return "Observability";
  return "Refinement";
}

function detectStack(m: string): { label: string; nodes: ArchitectureNode[]; files: FilePlanItem[] } | null {
  if (/next\.?js|nextjs/.test(m)) {
    return { label: "Next.js", nodes: [{ name: "Web App", description: "Next.js", dependencies: [] }],
      files: [{ path: "apps/web", description: "Next.js app" }] };
  }
  if (/fastapi/.test(m)) {
    return { label: "FastAPI", nodes: [{ name: "API", description: "FastAPI", dependencies: ["Web App"] }],
      files: [{ path: "services/api", description: "FastAPI service" }] };
  }
  if (/\bexpress\b|\bnode\b/.test(m) && /(use|switch|instead)/.test(m)) {
    return { label: "Express", nodes: [{ name: "API", description: "Express", dependencies: ["Web App"] }],
      files: [{ path: "services/api", description: "Express service" }] };
  }
  return null;
}

function applyStack(data: BlueprintDetailsData, hit: { nodes: ArchitectureNode[]; files: FilePlanItem[] }): void {
  for (const node of hit.nodes) {
    const i = data.architecture.findIndex((n) => n.name === node.name);
    if (i >= 0) data.architecture[i] = node; else data.architecture.push(node);
  }
  for (const f of hit.files) {
    const i = data.file_plan.findIndex((p) => p.path === f.path);
    if (i >= 0) data.file_plan[i] = f; else data.file_plan.unshift(f);
  }
}

function detectComponent(m: string): (ArchitectureNode & { batchName: string; allowed: string[] }) | null {
  if (/worker|queue/.test(m)) {
    return { name: "Worker / Queue", description: "Background jobs", dependencies: ["API"], batchName: "Worker & queue", allowed: ["services/worker/**"] };
  }
  if (/redis|cache/.test(m)) {
    return { name: "Cache (Redis)", description: "Caching layer", dependencies: ["API"], batchName: "Caching layer", allowed: ["services/api/**"] };
  }
  if (/database|postgres|\bdb\b/.test(m) && /(add|use)/.test(m)) {
    return { name: "Database", description: "Persistent storage", dependencies: ["API"], batchName: "Data model & migrations", allowed: ["db/**"] };
  }
  return null;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

// ---- domain knowledge -----------------------------------------------------------------
function inferDomain(idea: string): Domain {
  const s = idea.toLowerCase();
  if (/(game|platformer|phaser|arcade|canvas)/.test(s)) return "web-game";
  if (/(api|fastapi|service|endpoint)/.test(s)) return "api";
  return "web-app";
}

function stackFor(domain: Domain): string[] {
  return domain === "web-game" ? ["Phaser 3", "TypeScript", "Vite"] : ["Next.js", "FastAPI", "PostgreSQL", "Docker"];
}

function architecture(domain: Domain): ArchitectureNode[] {
  if (domain === "web-game") {
    return [
      { name: "Web Client (Phaser)", description: "Canvas game", dependencies: [] },
      { name: "Asset pipeline", description: "Original art", dependencies: ["Web Client (Phaser)"] },
      { name: "Level engine", description: "Data-driven levels", dependencies: ["Web Client (Phaser)"] },
      { name: "CI / Pages", description: "Build + deploy", dependencies: [] },
    ];
  }
  return [
    { name: "Web App", description: "Frontend", dependencies: [] },
    { name: "API", description: "Business logic", dependencies: ["Web App"] },
    { name: "Database", description: "Storage", dependencies: ["API"] },
    { name: "Worker / Queue", description: "Background jobs", dependencies: ["API"] },
    { name: "Admin Dashboard", description: "Ops & analytics", dependencies: ["Web App", "API"] },
  ];
}

function filePlan(domain: Domain): FilePlanItem[] {
  if (domain === "web-game") {
    return [
      { path: "src/scenes", description: "Boot/Preload/Game/…" },
      { path: "src/levels", description: "level data + builder" },
      { path: "src/entities", description: "Player, enemies, Coin" },
      { path: "public/assets", description: "original art" },
      { path: "README.md", description: "overview" },
    ];
  }
  return [
    { path: "apps/web", description: "Web app and dashboard" },
    { path: "services/api", description: "API and business logic" },
    { path: "services/worker", description: "Background jobs" },
    { path: "packages/shared", description: "Shared types" },
    { path: "db", description: "Migrations" },
    { path: "README.md", description: "overview" },
  ];
}

function roadmap(domain: Domain): DesignerBatch[] {
  const spec: [string, string[]][] =
    domain === "web-game"
      ? [
          ["Game foundation", ["vite.config.ts", "src/main.ts"]],
          ["Asset pipeline", ["scripts/gen_assets.py", "public/assets/**"]],
          ["Tilemap world", ["src/levels/**"]],
          ["Player & controls", ["src/entities/Player.ts"]],
          ["Enemies & power-ups", ["src/entities/**"]],
          ["HUD & gate", ["src/ui/HUD.ts"]],
          ["Campaign & boss", ["src/levels/episodes.ts"]],
          ["Polish & release", [".github/workflows/deploy.yml"]],
        ]
      : [
          ["Foundation", ["apps/web/**", "services/api/**"]],
          ["Integrations", ["services/api/**"]],
          ["Workflow & logic", ["services/api/**"]],
          ["Admin & analytics", ["apps/web/**"]],
          ["Hardening & deploy", ["docker-compose.yml", ".github/**"]],
          ["Validation & release", ["tests/**"]],
        ];
  return spec.map(([name, allowed], i): DesignerBatch => ({
    id: `batch-${String(i + 1).padStart(2, "0")}`,
    name,
    purpose: `${name}.`,
    tasks: [name],
    allowed_files: allowed,
    depends_on: i > 0 ? [`batch-${String(i).padStart(2, "0")}`] : [],
    acceptance_criteria: ["builds", "feature works", "no runtime errors"],
    validation_checks: ["lint", "typecheck", "tests"],
    must_not_change: [],
  }));
}

function extra(start: number, count: number): DesignerBatch[] {
  const names = ["Observability", "Performance pass", "Security review", "Docs & onboarding", "Accessibility"];
  const out: DesignerBatch[] = [];
  for (let k = 0; k < count; k++) {
    const i = start + k + 1;
    out.push({
      id: `batch-${String(i).padStart(2, "0")}`,
      name: names[k % names.length],
      purpose: "Production hardening.",
      tasks: ["hardening"],
      allowed_files: ["**"],
      depends_on: [`batch-${String(i - 1).padStart(2, "0")}`],
      acceptance_criteria: ["meets the production bar"],
      validation_checks: ["tests"],
      must_not_change: [],
    });
  }
  return out;
}
