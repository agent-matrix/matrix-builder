import type { NextConfig } from "next";

/**
 * Go-live topology (Phase 1, free):
 *
 *   builder.matrixhub.io  ──►  this Next.js app on Vercel
 *        /api/builder/*         →  Matrix Builder API   (Hugging Face Space)
 *        /api/agent-generator/* →  agent-generator      (Hugging Face Space)
 *        /api/ollabridge/*      →  OllaBridge Cloud LLM  (Hugging Face Space)
 *
 * Same-origin rewrites keep every backend behind builder.matrixhub.io, so the
 * browser never sees a raw *.hf.space URL and there is no CORS to configure.
 * The frontend itself talks only to /api/builder (NEXT_PUBLIC_API_BASE_URL);
 * the agent-generator and ollabridge rewrites expose those services on the same
 * origin for the CLI, GitPilot, and future clients.
 *
 * HF Spaces custom domains require a paid plan, so we proxy the free *.hf.space
 * hosts instead of pointing DNS at them directly.
 */
const builderSpace = process.env.MATRIX_BUILDER_SPACE_URL ?? "https://ruslanmv-matrix-builder.hf.space";
const agentGeneratorSpace = process.env.AGENT_GENERATOR_SPACE_URL ?? "https://ruslanmv-agent-generator.hf.space";
const ollabridgeSpace = process.env.OLLABRIDGE_SPACE_URL ?? "https://ruslanmv-ollabridge.hf.space";

const stripTrailingSlash = (url: string) => url.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  experimental: {},
  async rewrites() {
    return [
      {
        source: "/api/builder/:path*",
        destination: `${stripTrailingSlash(builderSpace)}/:path*`,
      },
      {
        source: "/api/agent-generator/:path*",
        destination: `${stripTrailingSlash(agentGeneratorSpace)}/:path*`,
      },
      {
        source: "/api/ollabridge/:path*",
        destination: `${stripTrailingSlash(ollabridgeSpace)}/:path*`,
      },
    ];
  },
};

export default nextConfig;
