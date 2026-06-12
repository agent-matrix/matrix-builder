export type QualityLevel = "minimal" | "starter" | "standard" | "production" | "enterprise";

export interface BlueprintCandidate {
  id: "minimal" | "standard" | "production";
  tier: "Minimal" | "Standard" | "Production";
  name: string;
  summary: string;
  stack: string[];
  files: number;
  difficulty: "Easy" | "Medium" | "Hard";
  time: string;
  standards: string[];
  recommended?: boolean;

  candidate_id?: string;
  slug?: string;
  quality_level?: "starter" | "standard" | "production" | "enterprise";
  generator_actions?: string[];
  validation_checks?: string[];
}

export type { BlueprintCandidateContract, BlueprintResultContract } from "./contracts";
