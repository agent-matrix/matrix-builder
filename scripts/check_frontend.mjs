import fs from "node:fs";
import path from "node:path";

const roots = ["apps/web/src", "packages/client-sdk/src", "packages/ui/src"];
const required = [
  "apps/web/src/app/matrix-builder/page.tsx",
  "apps/web/src/app/matrix-builder/MatrixBuilderClient.tsx",
  "apps/web/src/types/coder.ts",
  "apps/web/src/lib/constants.ts",
  "apps/web/src/lib/matrix-demo-data.ts",
  "apps/web/src/lib/matrix-bundle.ts",
  "apps/web/src/lib/coder-prompts.ts",
  "apps/web/src/lib/zip.ts",
  "apps/web/src/styles/matrix-builder.css",
  "design-handoff/scout/project/scout/Matrix-Builder.html",
];

for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`Missing required frontend file: ${file}`);
    process.exit(1);
  }
}

const client = fs.readFileSync("apps/web/src/app/matrix-builder/MatrixBuilderClient.tsx", "utf8") + "\n" + fs.readFileSync("apps/web/src/lib/constants.ts", "utf8");
const css = fs.readFileSync("apps/web/src/styles/matrix-builder.css", "utf8");
const requiredClientPhrases = [
  "Give AI coders a",
  "Generate blueprint",
  "SCANNING_MESSAGES",
  "BlueprintCandidate",
  "Your Matrix Bundle is ready",
  "Download ZIP",
  "Copy prompt",
  "Validate result",
  "Claude Code",
  "GitPilot",
  "IBM Bob",
];
for (const phrase of requiredClientPhrases) {
  if (!client.includes(phrase)) {
    console.error(`Matrix Builder UI missing expected phrase or symbol: ${phrase}`);
    process.exit(1);
  }
}

const requiredCssSelectors = [".l-dark", ".l-hero", ".cand-grid", ".darkpanel", ".bundle-grid", ".coder-seg", ".build-opts"];
for (const selector of requiredCssSelectors) {
  if (!css.includes(selector)) {
    console.error(`Matrix Builder CSS missing selector: ${selector}`);
    process.exit(1);
  }
}

const bad = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    if (entry.isFile() && /\.(ts|tsx|js|jsx|css)$/.test(entry.name)) {
      const text = fs.readFileSync(full, "utf8");
      if (text.includes("\t")) bad.push(`${full}: contains tab`);
    }
  }
}
for (const root of roots) walk(root);
if (bad.length) {
  console.error(bad.join("\n"));
  process.exit(1);
}
console.log("Frontend Scout UI checks passed.");
