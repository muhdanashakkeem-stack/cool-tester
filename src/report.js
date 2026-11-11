import chalk from "chalk";

const color = { critical: chalk.bgRed.white.bold, high: chalk.red.bold, medium: chalk.yellow, low: chalk.blue };
const tag = (f) => (f.type === "attack" ? "ATTACK" : f.type === "speed" ? "SPEED" : "CODE");

export function printTerminal({ valid_structure, error, summary, findings, stats, attack_url, routes_tested }) {
  console.log(chalk.bold("\n😎 Cool Tester report\n"));
  if (valid_structure === false && error) {
    console.log(chalk.bgRed.white.bold(" STRUCTURE ERROR ") + " " + chalk.red.bold(error));
    console.log();
  }
  if (stats) console.log(chalk.dim(`Read ${stats.files} files: ${Object.entries(stats.byLang).map(([k, v]) => `${k} ${v}`).join(", ") || "no code files"}`));
  if (attack_url) console.log(chalk.dim(`Tested ${attack_url} (${routes_tested} routes found)`));
  console.log();
  if (!findings.length) return console.log(chalk.green("✔ No issues found.\n"));
  for (const sev of ["critical", "high", "medium", "low"]) {
    const group = findings.filter((f) => f.severity === sev);
    if (!group.length) continue;
    console.log(color[sev](` ${sev.toUpperCase()} (${group.length}) `));
    for (const f of group) {
      console.log(`  ${chalk.bold(f.issue)}  ${chalk.dim(`[${tag(f)}${f.category ? "/" + f.category : ""}] ${f.file}${f.line ? ":" + f.line : ""}`)}`);
      if (f.evidence_masked) console.log(chalk.dim("    " + f.evidence_masked));
      console.log(`    Risk: ${f.why_it_matters}`);
      console.log(`    → ${f.how_to_fix}`);
    }
    console.log();
  }
  console.log(`Score ${summary.score}/100 · ${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low`);
  console.log(chalk.dim("Next: `cool-tester report --fix-prompt`, paste into your AI agent, then `cool-tester verify`.\n"));
}

const ST = { open: chalk.red.bold("✖ OPEN      "), pass: chalk.green("✔ CLEAN     "), confirm: chalk.green("✔ NONE FOUND"), by_hand: chalk.yellow("☐ BY HAND   "), not_tested: chalk.dim("– NOT TESTED") };

export function printLocks({ summary, locks }, showHow = false) {
  console.log(chalk.bold("\n🔒 Cool Tester: the 12 Locks (+2 bonus)\n"));
  let g = "";
  for (const L of locks) {
    if (L.group !== g) { g = L.group; console.log(chalk.bold.underline(g)); }
    const extra = [L.rotate_by_hand && L.status === "open" ? chalk.red("ROTATE KEY BY HAND") : "", L.can_lock_you_out ? chalk.yellow("commit first, can lock you out") : ""].filter(Boolean).join(" · ");
    console.log(` ${String(L.lock).padStart(2)}  ${ST[L.status]}  ${L.name}${L.findings.length ? chalk.dim(` (${L.findings.length})`) : ""}${extra ? "  " + extra : ""}`);
    if (L.status === "open") L.findings.slice(0, 3).forEach((f) => console.log(chalk.dim(`        ${f.severity}: ${f.issue} @ ${f.where}`)));
    if (L.note) console.log(chalk.dim(`        ${L.note}`));
    if (showHow && L.status !== "not_tested") console.log(`        ${chalk.cyan("Check by hand:")} ${L.check_by_hand}`);
  }
  console.log(`\n${summary.open} open · ${summary.confirm_by_hand} to confirm by hand · ${summary.clean} clean · ${summary.not_tested} not tested`);
  console.log(chalk.dim('"None found" means Cool Tester found nothing, not that it is proven safe. Add --how for the by-hand checks.\n'));
}
