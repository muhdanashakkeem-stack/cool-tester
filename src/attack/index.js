import { assertLocal } from "./guard.js";
import { hit, resetSeen } from "./http.js";
import { discover } from "./discover.js";
import { TESTS } from "./tests.js";
import { summarize, SEV_ORDER } from "../scanner.js";

export async function attack(url, { path: codePath, token, samples = 20, only, routes } = {}) {
  const base = assertLocal(url).origin; // throws unless localhost
  resetSeen();
  const probe = await hit(base + "/");
  if (!probe.status) throw new Error(`Cannot reach ${base}. Start your app first, then run the attack again.`);
  const found = routes || await discover(base, codePath);
  const groups = only ? TESTS.filter((t) => only.includes(t.id)) : TESTS;
  const ctx = { base, routes: found, token, samples };
  const findings = [];
  for (const t of groups) findings.push(...await t.run(ctx));
  findings.sort((a, b) => SEV_ORDER[b.severity] - SEV_ORDER[a.severity]);
  return { url: base, samples, routes: found, tests: groups.map((g) => g.id), findings, summary: summarize(findings) };
}
