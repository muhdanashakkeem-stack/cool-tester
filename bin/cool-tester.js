#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import { check, runAttack, report, fixPrompt, verify, locks, fixEnv, audit } from "../src/api.js";
import { meetsThreshold } from "../src/scanner.js";
import { printTerminal, printLocks } from "../src/report.js";
import { buildFixPrompt } from "../src/fixPrompt.js";

const program = new Command();
program.name("cool-tester").description("Offline security tester for vibe coders. No API key.").version("0.2.0");

const out = (r, o) => { if (o.json) console.log(JSON.stringify(r, null, 2)); else if (o.fixPrompt) console.log(buildFixPrompt(r)); else printTerminal(r); };
const gate = (r, o) => { if (o.failOn && meetsThreshold(r.summary, o.failOn)) process.exit(1); };
const fail = (e) => { console.error(chalk.red("✖ " + e.message)); process.exit(2); };

program.command("audit [path]").description("ONE COMMAND complete autonomous audit: static check, local attack, speed, 12 locks & HTML dashboard")
  .option("--url <url>", "local app URL (e.g. http://localhost:3000; auto-detected if omitted)")
  .option("--token <t>", "optional demo user token")
  .option("--samples <n>", "requests per route for speed test", "5")
  .option("--json", "output report as JSON")
  .action(async (p, o) => {
    try {
      const res = await audit(p, o);
      if (o.json) console.log(JSON.stringify(res.report, null, 2));
    } catch (e) { fail(e); }
  });

program.command("check [path]").description("Read the code: secrets, git/.env, weak web code, speed").option("--json").option("--fix-prompt").option("--fail-on <level>")
  .action((p, o) => { try { const r = check(p); out(report(p), o); gate(r, o); } catch (e) { fail(e); } });

program.command("attack <url>").description("Attack your app running on localhost (refuses anything else)")
  .option("--path <dir>", "project folder (reads routes from code)").option("--token <t>", "demo user token").option("--samples <n>", "requests per route for speed test", "20")
  .option("--json").option("--fix-prompt").option("--fail-on <level>")
  .action(async (url, o) => { try { const r = await runAttack(url, { path: o.path, token: o.token, samples: Number(o.samples) }); out(report(o.path), o); gate(r, o); } catch (e) { fail(e); } });

program.command("report [path]").description("Show the latest combined report").option("--json").option("--fix-prompt")
  .action((p, o) => out(report(p), o));

program.command("verify [path]").description("Re-run only the failed checks after fixing").option("--token <t>").option("--json")
  .action(async (p, o) => { try {
    const r = await verify(p, o);
    if (o.json) return console.log(JSON.stringify(r, null, 2));
    console.log(chalk.green(`\n✔ Fixed: ${r.counts.fixed}`) + chalk.red(`   ✖ Still failing: ${r.counts.still_failing}`) + chalk.yellow(`   ＋ New: ${r.counts.new_issues}`));
    [...r.still_failing, ...r.new_issues].forEach((f) => console.log(`  - [${f.severity}] ${f.issue} (${f.file})`));
    console.log(`Score ${r.summary.score}/100\n`);
    if (r.counts.still_failing + r.counts.new_issues) process.exit(1);
  } catch (e) { fail(e); } });

program.command("locks [path]").description("Score your app against the 12 Locks (+2 bonus) from the latest check/attack")
  .option("--json").option("--how", "show the by-hand check for every lock").option("--fail-on-open", "exit 1 if any lock is open")
  .action((p, o) => { const r = locks(p); if (o.json) console.log(JSON.stringify(r, null, 2)); else printLocks(r, o.how); if (o.failOnOpen && r.summary.open) process.exit(1); });

program.command("fix [path]").description("Automatically create or update .gitignore to protect secrets and .env")
  .action((p) => {
    try {
      const res = fixEnv(p);
      console.log(chalk.green(`\n✔ ${res.message}\n`));
    } catch (e) { fail(e); }
  });

program.command("mcp").description("Start the MCP server (for Cursor, Claude Code, etc.)")
  .action(async () => { const { startMcp } = await import("../src/mcp.js"); await startMcp(); });

program.parse();
