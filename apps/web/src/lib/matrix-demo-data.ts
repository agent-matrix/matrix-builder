// OFFLINE FALLBACK ONLY. The build flow calls the engine (/blueprints/candidates) for real
// candidates; this deterministic generator is used solely when the API is unreachable, so the
// demo still renders without a backend. Kept in shape-parity with the engine's candidates.
import type { BlueprintCandidate } from "@/types/blueprint";
import { IDEA_EXAMPLES } from "./constants";
import { slugify } from "./ids";

export { IDEA_EXAMPLES };

export function createBlueprintCandidates(idea: string): BlueprintCandidate[] {
  const slug = slugify(idea);
  return [
    {
      id: "minimal",
      tier: "Minimal",
      name: `${slug}-lite`,
      summary: "The smallest controlled scaffold — validate the idea fast.",
      stack: ["Python", "FastAPI"],
      files: 14,
      difficulty: "Easy",
      time: "a weekend",
      standards: ["PEP 8", "12-Factor", "Semantic API"],
    },
    {
      id: "standard",
      tier: "Standard",
      recommended: true,
      name: slug,
      summary: "Balanced architecture with tests, docs, CI, and a safe build contract.",
      stack: ["Python", "FastAPI", "React", "Docker"],
      files: 31,
      difficulty: "Medium",
      time: "~1 week",
      standards: ["PEP 8", "12-Factor", "OpenAPI", "OWASP ASVS", "CI/CD"],
    },
    {
      id: "production",
      tier: "Production",
      name: `${slug}-pro`,
      summary: "Hardened, observable, and scalable for real users.",
      stack: ["Python", "FastAPI", "React", "Docker", "K8s", "Postgres"],
      files: 58,
      difficulty: "Hard",
      time: "~3 weeks",
      standards: ["PEP 8", "12-Factor", "OpenAPI", "OWASP ASVS", "CI/CD", "OpenTelemetry", "SLSA"],
    },
  ];
}
