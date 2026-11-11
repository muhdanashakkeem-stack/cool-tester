import fs from "node:fs";
import path from "node:path";

export const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules", ".git", "dist", "build", ".next", "out", ".nuxt", ".svelte-kit",
  "coverage", ".cool-tester", ".turbo", ".vercel", "vendor", "__pycache__",
  "venv", ".venv", "env"
]);
export const IGNORE_FILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "composer.lock",
  ".env", ".env.local", ".env.development", ".env.production", ".env.test"
]);
const BINARY_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz", ".mp4",
  ".mp3", ".woff", ".woff2", ".ttf", ".eot", ".exe", ".dll", ".so", ".map", ".svg",
  ".py", ".pyc", ".pyo", ".pyd"
]);
export const isBinaryExt = (f) => BINARY_EXT.has(path.extname(f).toLowerCase());

// .cooltesterignore: one pattern per line. Supports "dir/", "*.ext" and plain substrings. "#" = comment.
export function loadUserIgnore(root) {
  const file = path.join(root, ".cooltesterignore");
  if (!fs.existsSync(file)) return () => false;
  const patterns = fs.readFileSync(file, "utf8").split("\n")
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  return (rel) => {
    const norm = rel.split(path.sep).join("/");
    return patterns.some((p) => {
      const pNorm = p.replace(/\\/g, "/");
      if (pNorm.startsWith("*.")) return norm.endsWith(pNorm.slice(1));
      if (pNorm.endsWith("/")) return norm.startsWith(pNorm) || norm.includes("/" + pNorm) || (norm + "/").includes("/" + pNorm);
      return norm === pNorm || norm.includes(pNorm);
    });
  };
}
