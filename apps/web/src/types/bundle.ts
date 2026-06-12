import type { CoderId } from "./coder";

export interface BundleFile {
  name: string;
  content: string;
  path?: string;
  kind?: string;
  required?: boolean;
}

export interface MatrixBundle {
  bundleId: string;
  idea: string;
  blueprintName: string;
  promptByCoder: Record<CoderId, string>;
  files: BundleFile[];
}

export type { BundleFileContract, MatrixBundleContract } from "./contracts";
