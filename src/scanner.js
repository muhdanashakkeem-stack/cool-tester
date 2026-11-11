import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mask } from "./mask.js";
import { entropy, isPlaceholder } from "./entropy.js";
import { DEFAULT_IGNORE_DIRS, IGNORE_FILES, isBinaryExt, loadUserIgnore } from "./ignore.js";
import { checkEnv, isEnvFile } from "./envChecks.js";
import { scanGitHistory } from "./gitHistory.js";
import { projectChecks } from "./projectChecks.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const MAX_BYTES = 1024 * 1024;
export const SEV_ORDER = { critical: 4, high: 3, medium: 2, low: 1 };
const LANG_BY_EXT = {
  ".js": "js", ".jsx": "js", ".ts": "js", ".tsx": "js", ".mjs": "js", ".cjs": "js", ".vue": "js", ".svelte": "js",
  ".html": "html", ".htm": "html", ".ejs": "html", ".hbs": "html",
  ".css": "css", ".scss": "css", ".sass": "css", ".less": "css",
  ".sql": "sql", ".php": "php", ".go": "go", ".java": "java", ".rb": "rb"
};
const DEFAULT_LANGS = ["js", "html", "php", "go", "java", "rb"];

export function loadRules() {
  const dir = path.join(here, "..", "rules");
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).flatMap((f) =>
    JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")).map((r) => ({ ...r, re: new RegExp(r.regex, r.flags || "") })));
}

export function summarize(findings) {
  const s = { critical: 0, high: 0, medium: 0, low: 0 };
  findings.forEach((f) => s[f.severity]++);
  s.score = Math.max(0, 100 - 25 * s.critical - 12 * s.high - 5 * s.medium - s.low);
  return s;
}

export function validateProjectStructure(root) {
  if (!fs.existsSync(root)) {
    return { valid: false, error: "Folder structure is not correct: target directory does not exist and cannot be read." };
  }
  let st;
  try {
    st = fs.statSync(root);
  } catch {
    return { valid: false, error: "Folder structure is not correct: unable to read target directory permissions." };
  }
  if (!st.isDirectory()) {
    return { valid: false, error: "Folder structure is not correct: path is not a valid project directory." };
  }
  return { valid: true };
}

export function scan(root = process.cwd()) {
  root = path.resolve(root);
  const validation = validateProjectStructure(root);
  if (!validation.valid) {
    const errFinding = {
      id: "STRUCT001",
      severity: "critical",
      type: "code",
      verify_test_id: "code",
      category: "structure",
      file: root,
      line: 0,
      issue: "Invalid Folder Structure — Cannot Read Project Code",
      evidence_masked: validation.error,
      why_it_matters: "The scanner cannot read the project code because the folder structure is missing or unreadable.",
      how_to_fix: "Ensure the project root exists, contains valid source code files (e.g. package.json, src/), and has read permissions."
    };
    return {
      valid_structure: false,
      error: validation.error,
      summary: summarize([errFinding]),
      stats: { files: 0, byLang: {} },
      findings: [errFinding]
    };
  }

  const rules = loadRules();
  const userIgnored = loadUserIgnore(root);
  const findings = [];
  const envFiles = [];
  const stats = { files: 0, byLang: {} };

  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir); } catch { return; }
    for (const name of entries) {
      const full = path.join(dir, name);
      const rel = path.relative(root, full).split(path.sep).join("/");
      let st;
      try { st = fs.lstatSync(full); } catch { continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        if (DEFAULT_IGNORE_DIRS.has(name) || userIgnored(rel + "/")) continue;
        walk(full);
        continue;
      }
      // Track .env file existence for gitignore checks, but NEVER open or read .env file contents!
      if (isEnvFile(name)) {
        envFiles.push(rel);
        continue;
      }
      if (IGNORE_FILES.has(name) || isBinaryExt(name) || st.size > MAX_BYTES || userIgnored(rel)) continue;
      const lang = LANG_BY_EXT[path.extname(name).toLowerCase()] || null;
      if (!lang) continue; // Read only supported code files
      stats.files++;
      stats.byLang[lang] = (stats.byLang[lang] || 0) + 1;
      scanFile(full, rel, rules, findings, lang);
    }
  })(root);

  if (stats.files === 0) {
    findings.push({
      id: "STRUCT002",
      severity: "high",
      type: "code",
      verify_test_id: "code",
      category: "structure",
      file: ".",
      line: 0,
      issue: "Folder structure is not correct — no readable code files found",
      evidence_masked: "0 readable code files in directory",
      why_it_matters: "AI agent and frontend cannot verify security when no valid source code files are present in the folder structure.",
      how_to_fix: "Check your project folder path and structure. Make sure source files (JS/TS/HTML/CSS/SQL/Go/PHP) are inside the project folder."
    });
  }

  findings.push(...checkEnv(root, envFiles));
  findings.push(...scanGitHistory(root, rules));
  findings.push(...projectChecks(root));
  findings.forEach((f) => { f.type = f.category === "speed" ? "speed" : "code"; f.verify_test_id = "code"; f.category = f.category || "general"; });
  findings.sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity]);
  return {
    valid_structure: stats.files > 0,
    error: stats.files === 0 ? "Folder structure is not correct: cannot read any code files in this directory." : null,
    summary: summarize(findings),
    stats,
    findings
  };
}

function scanFile(full, rel, rules, findings, lang) {
  let text;
  try { text = fs.readFileSync(full, "utf8"); } catch { return; }
  if (text.includes("\0")) return;
  text.split("\n").forEach((line, i) => {
    if (line.length > 2000) return;
    let specificHit = false;
    for (const r of rules) {
      if (r.kind !== "secret" && !(lang && (r.langs || DEFAULT_LANGS).includes(lang))) continue;
      const m = line.match(r.re);
      if (!m) continue;
      const generic = r.id === "SEC011";
      if (generic && (specificHit || /process\.env|import\.meta\.env|os\.environ/.test(line))) continue;
      const secret = m[1] || m[0];
      if (r.entropy && (isPlaceholder(secret) || entropy(secret) < r.entropy)) continue;
      if (!generic) specificHit = true;
      const evidence = r.mask === false ? line.trim().slice(0, 160)
        : r.id === "SEC012" ? m[0].trim() + " ****"
        : line.trim().split(secret).join(mask(secret)).slice(0, 160);
      findings.push({ id: r.id, severity: r.severity, file: rel, line: i + 1, issue: r.name,
        evidence_masked: evidence, why_it_matters: r.why, how_to_fix: r.fix, category: r.category || (r.kind === "secret" ? "secrets" : "general"), lang });
    }
  });
}

export const meetsThreshold = (summary, level) =>
  Object.entries(summary).some(([sev, n]) => sev in SEV_ORDER && n > 0 && SEV_ORDER[sev] >= SEV_ORDER[level]);
