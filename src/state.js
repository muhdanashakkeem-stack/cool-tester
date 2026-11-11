import fs from "node:fs";
import path from "node:path";
import { summarize, SEV_ORDER } from "./scanner.js";

const file = (root) => path.join(root, ".cool-tester", "last-report.json");

export function loadState(root = process.cwd()) {
  try { return JSON.parse(fs.readFileSync(file(root), "utf8")); } catch { return {}; }
}
export function saveState(patch, root = process.cwd()) {
  const s = { ...loadState(root), ...patch, updated: new Date().toISOString() };
  fs.mkdirSync(path.dirname(file(root)), { recursive: true });
  fs.writeFileSync(file(root), JSON.stringify(s, null, 2));
  return s;
}
export function merged(state) {
  const findings = [...(state.code?.findings || []), ...(state.attack?.findings || [])]
    .sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity]);
  return {
    valid_structure: state.code?.valid_structure ?? true,
    error: state.code?.error || null,
    summary: summarize(findings),
    stats: state.code?.stats,
    attack_url: state.attack?.url,
    routes_tested: state.attack?.routes?.length,
    findings,
    updated: state.updated
  };
}
