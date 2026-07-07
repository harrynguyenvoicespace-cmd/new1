import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dotNextRoot = path.join(projectRoot, ".open-next", "server-functions", "default", ".next");
const chunksRoot = path.join(dotNextRoot, "server", "chunks");

if (!existsSync(chunksRoot)) {
  console.log("[opennext-fix] No OpenNext chunk directory found; skipping.");
  process.exit(0);
}

const runtimeFiles = [
  path.join(chunksRoot, "[turbopack]_runtime.js"),
  path.join(chunksRoot, "ssr", "[turbopack]_runtime.js"),
].filter(existsSync);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function slash(value) {
  return value.split(path.sep).join("/");
}

const chunkFiles = walk(chunksRoot)
  .filter((filePath) => filePath.endsWith(".js"))
  .filter((filePath) => path.basename(filePath) !== "[turbopack]_runtime.js")
  .sort((a, b) => a.localeCompare(b));

const requireChunkPattern =
  /function requireChunk\(chunkPath\) \{\s*switch\(chunkPath\) \{[\s\S]*?default:\s*throw new Error\(`Not found \$\{chunkPath\}`\);\s*\}\s*\}/;

for (const runtimeFile of runtimeFiles) {
  const runtimeDir = path.dirname(runtimeFile);
  const cases = chunkFiles
    .map((chunkFile) => {
      const chunkPath = slash(path.relative(dotNextRoot, chunkFile));
      let requirePath = slash(path.relative(runtimeDir, chunkFile));
      if (!requirePath.startsWith(".")) {
        requirePath = `./${requirePath}`;
      }
      return `      case "${chunkPath}": return require("${requirePath}");`;
    })
    .join("\n");

  const replacement = `function requireChunk(chunkPath) {
    switch(chunkPath) {
${cases}
      default:
        throw new Error(\`Not found \${chunkPath}\`);
    }
  }`;

  const current = readFileSync(runtimeFile, "utf8");
  if (!requireChunkPattern.test(current)) {
    throw new Error(`[opennext-fix] Could not find requireChunk() in ${runtimeFile}`);
  }
  writeFileSync(runtimeFile, current.replace(requireChunkPattern, replacement));
  console.log(`[opennext-fix] Patched ${path.relative(projectRoot, runtimeFile)} with ${chunkFiles.length} chunks.`);
}
