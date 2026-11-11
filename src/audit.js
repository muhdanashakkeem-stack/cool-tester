import path from "node:path";
import chalk from "chalk";
import { check, runAttack, report, fixPrompt, locks } from "./api.js";
import { hit } from "./attack/http.js";
import { printTerminal, printLocks } from "./report.js";
import { generateHtmlDashboard } from "./dashboard.js";

const CANDIDATE_PORTS = [3000, 5173, 8000, 8080, 4000, 5000, 4200, 3001, 8888];

export async function detectLocalServer() {
  for (const port of CANDIDATE_PORTS) {
    const url = `http://localhost:${port}`;
    try {
      const res = await hit(url + "/", { timeout: 400 });
      if (res.status && res.status !== 0) {
        return url;
      }
    } catch {}
  }
  return null;
}

export async function runAudit(targetPath = process.cwd(), options = {}) {
  const root = path.resolve(targetPath);
  console.log(chalk.bold.cyan("\n============================================================"));
  console.log(chalk.bold.cyan("       😎 COOL TESTER AUTONOMOUS TESTING & SECURITY ENGINE   "));
  console.log(chalk.bold.cyan("============================================================\n"));

  // Phase 1: Source Code & Folder Structure Analysis
  console.log(chalk.bold("▶ Phase 1: Source Code & Structure Analysis"));
  console.log(chalk.dim(`  Inspecting: ${root}`));
  const codeRes = check(root);
  console.log(chalk.green(`  ✔ Scanned ${codeRes.stats.files} files across languages (${Object.keys(codeRes.stats.byLang).join(", ") || "none"})`));
  if (codeRes.summary.critical > 0) {
    console.log(chalk.red(`  ✖ Found ${codeRes.summary.critical} critical security issues in static code!`));
  }

  // Phase 2: Live Ethical Hacking on Localhost
  console.log(chalk.bold("\n▶ Phase 2: Localhost Ethical Hack & Speed Profiling"));
  let targetUrl = options.url;
  if (!targetUrl) {
    process.stdout.write(chalk.dim("  Scanning common ports (3000, 5173, 8000, 8080...) for live app... "));
    targetUrl = await detectLocalServer();
    if (targetUrl) {
      console.log(chalk.green(`Found alive server on ${targetUrl}!`));
    } else {
      console.log(chalk.yellow("No live server detected."));
      console.log(chalk.dim("  (Tip: Start your dev server and pass --url http://localhost:PORT to include live attack probes)"));
    }
  }

  let attackRes = null;
  if (targetUrl) {
    console.log(chalk.dim(`  Attacking ${targetUrl} (probing auth, cookies, CORS, rate limits, XSS, SQLi)...`));
    attackRes = await runAttack(targetUrl, { path: root, token: options.token, samples: options.samples || 5 });
    console.log(chalk.green(`  ✔ Dynamic probes complete! Tested ${attackRes.routes.length} discovered routes.`));
  }

  // Phase 3: The 12 Locks Evaluation
  console.log(chalk.bold("\n▶ Phase 3: The 12 Locks Security Evaluation"));
  const locksRes = locks(root);
  console.log(chalk.green(`  ✔ Locks evaluated: ${locksRes.summary.clean} clean, ${locksRes.summary.confirm_by_hand} to verify, ${locksRes.summary.open} open doors.`));

  // Phase 4: Full Merged Report & AI Fix Remediation Prompt
  const full = report(root);
  const prompt = fixPrompt(root);

  // Phase 5: Generate HTML Dashboard
  const htmlPath = generateHtmlDashboard(root, { fullReport: full, locksReport: locksRes, prompt });
  console.log(chalk.bold("\n▶ Phase 4: Interactive Dashboard Generated"));
  console.log(chalk.cyan(`  ✔ Standalone HTML Dashboard: ${htmlPath}\n`));

  // Display terminal report
  printTerminal(full);
  printLocks(locksRes);

  console.log(chalk.bold.yellow("🤖 AI REMEDIATION INSTRUCTIONS:"));
  console.log(chalk.dim("Run `npx cool-tester report --fix-prompt` or copy the prompt from the HTML dashboard"));
  console.log(chalk.dim("into your AI agent (Cursor, Claude Code, Antigravity) to fix all issues in one prompt."));
  console.log(chalk.dim("Then run `npx cool-tester verify` to confirm all doors are locked!\n"));

  return {
    code: codeRes,
    attack: attackRes,
    locks: locksRes,
    report: full,
    prompt,
    dashboardHtml: htmlPath
  };
}
