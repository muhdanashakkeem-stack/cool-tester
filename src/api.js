import path from "node:path";
import { scan, summarize } from "./scanner.js";
import { attack } from "./attack/index.js";
import { loadState, saveState, merged } from "./state.js";
import { buildFixPrompt } from "./fixPrompt.js";
import { evaluateLocks } from "./locks.js";
import { fixEnv as doFixEnv } from "./envChecks.js";
import { runAudit as doRunAudit } from "./audit.js";

const R = (p) => path.resolve(p || process.cwd());

export const fixEnv = (p) => doFixEnv(R(p));
export const audit = (p, o) => doRunAudit(R(p), o);

export function check(p) {
  const root = R(p);
  const r = scan(root);
  saveState({ code: { path: root, ...r } }, root);
  return r;
}

export async function runAttack(url, o = {}) {
  const root = R(o.path);
  const r = await attack(url, { ...o, path: o.path ? root : undefined });
  saveState({ attack: { ...r, path: root } }, root);
  return r;
}

export const report = (p) => merged(loadState(R(p)));
export const fixPrompt = (p) => buildFixPrompt(report(p));

const keyOf = (f) => (f.verify_test_id === "code" ? `${f.id}|${f.file}|${f.evidence_masked}` : `${f.id}|${f.route}`);

// Re-run only what failed before and say what is fixed.
export async function verify(p, o = {}) {
  const root = R(p), s = loadState(root);
  const out = { fixed: [], still_failing: [], new_issues: [] };
  const diff = (oldF, newF) => {
    const oldK = new Set(oldF.map(keyOf)), newK = new Set(newF.map(keyOf));
    oldF.forEach((f) => (newK.has(keyOf(f)) ? out.still_failing : out.fixed).push(f));
    newF.forEach((f) => !oldK.has(keyOf(f)) && out.new_issues.push(f));
  };
  if (s.code?.findings?.length) {
    const r = scan(s.code.path);
    diff(s.code.findings, r.findings);
    s.code = { ...s.code, ...r };
  }
  if (s.attack?.findings?.length) {
    const groups = [...new Set(s.attack.findings.map((f) => f.verify_test_id))];
    const r = await attack(s.attack.url, { path: s.attack.path, only: groups, routes: s.attack.routes, samples: s.attack.samples, token: o.token });
    diff(s.attack.findings, r.findings);
    s.attack.findings = r.findings;
    s.attack.summary = summarize(r.findings);
  }
  saveState(s, root);
  const m = merged(s);
  return { ...out, summary: m.summary, counts: { fixed: out.fixed.length, still_failing: out.still_failing.length, new_issues: out.new_issues.length } };
}

export function locks(p) {
  const s = loadState(R(p));
  const rows = evaluateLocks(merged(s).findings, { code: !!s.code, attack: !!s.attack });
  const count = (st) => rows.filter((r) => r.status === st).length;
  return { summary: { open: count("open"), confirm_by_hand: count("confirm") + count("by_hand"), clean: count("pass"), not_tested: count("not_tested") }, locks: rows };
}
