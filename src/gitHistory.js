import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mask } from "./mask.js";
import { isEnvFile } from "./envChecks.js";

const run = (root, args) => execFileSync("git", args, { cwd: root, maxBuffer: 100 * 1024 * 1024, timeout: 30000, stdio: ["ignore", "pipe", "ignore"] }).toString();

// Looks for keys that were EVER committed, even if deleted later.
export function scanGitHistory(root, allRules) {
  if (!fs.existsSync(path.join(root, ".git"))) return [];
  const rules = allRules.filter((r) => r.kind === "secret" && !["SEC011", "SEC012"].includes(r.id));
  const out = [], seen = new Set();
  try {
    let commit = "", file = "";
    for (const rawLine of run(root, ["log", "--all", "-p", "--no-color", "--no-ext-diff", "--max-count=500", "--format=@@@%h"]).split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      if (line.startsWith("@@@")) { commit = line.slice(3); continue; }
      if (line.startsWith("+++ b/")) { file = line.slice(6); continue; }
      if (!line.startsWith("+") || line.startsWith("+++") || line.length > 2000) continue;
      for (const r of rules) {
        const m = line.match(r.re);
        if (!m) continue;
        const key = r.id + m[0];
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ id: "GIT001", severity: "critical", file, line: 0, issue: `${r.name} found in git history (commit ${commit})`,
          evidence_masked: mask(m[0]), category: "secrets",
          why_it_matters: "Deleting a key from the code does not remove it from history. Bots scan public repos for this within minutes.",
          how_to_fix: "Rotate the key in the provider's dashboard first, then purge it from history (git filter-repo or BFG) and force-push." });
      }
    }
    const names = new Set();
    let c = "";
    for (const rawLine of run(root, ["log", "--all", "--diff-filter=A", "--name-only", "--no-color", "--format=@@@%h"]).split(/\r?\n/)) {
      const line = rawLine.trim();
      if (line.startsWith("@@@")) { c = line.slice(3); continue; }
      if (line && isEnvFile(path.basename(line)) && !names.has(line)) {
        names.add(line);
        out.push({ id: "GIT002", severity: "critical", file: line, line: 0, issue: `.env file was committed at some point (commit ${c})`, evidence_masked: "", category: "secrets",
          why_it_matters: "Everything that was in that file is still readable in history.",
          how_to_fix: "Rotate every key that was inside it, then purge the file from history." });
      }
    }
  } catch { /* git missing or repo too large: skip quietly */ }
  return out;
}
