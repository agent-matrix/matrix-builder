// Minimal module-resolution hook so `node --test` can load source files that use the `@/` path
// alias (mapped to apps/web/src in tsconfig). Type-only imports are erased by type stripping, so
// only value imports reach this hook. Test-only; not used by Next.js (which resolves `@/` itself).
import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

const srcDir = resolvePath(import.meta.dirname, "../src");

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    let p = resolvePath(srcDir, specifier.slice(2));
    if (!/\.(ts|tsx|js|mjs|cjs|json)$/.test(p)) {
      if (existsSync(p + ".ts")) p += ".ts";
      else if (existsSync(p + ".tsx")) p += ".tsx";
    }
    return nextResolve(pathToFileURL(p).href, context);
  }
  return nextResolve(specifier, context);
}
