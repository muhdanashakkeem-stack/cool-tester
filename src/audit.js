import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { check, runAttack, report, fixPrompt, locks } from "./api.js";
import { hit } from "./attack/http.js";
import { normalizeTargetUrl } from "./attack/guard.js";
import { printTerminal, printLocks } from "./report.js";
import { generateHtmlDashboard } from "./dashboard.js";

const CANDIDATE_PORTS = [5000, 3000, 5173, 8000, 8080, 4000, 4200, 3001, 8888];

export function detectProjectPort(root) {
  const files = [
    "server.js", "app.js", "index.js", "main.py", "app.py", "package.json",
    ".env", ".env.local", ".env.development", "vite.config.js", "vite.config.ts"
  ];
  for (const f of files) {
    const full = path.join(root, f);
    if (!fs.existsSync(full)) continue;
    try {
      const text = fs.readFileSync(full, "utf8");
      const m = text.match(/(?:PORT\s*[:=]\s*|listen\s*\(\s*|port\s*[:=]\s*|-p\s+)(\d{4,5})/i);
      if (m && Number(m[1]) >= 1024) return Number(m[1]);
    } catch {}
  }
  return null;
}

export async function detectLocalServer(root) {
  const preferredPort = root ? detectProjectPort(root) : null;
  const portsToCheck = preferredPort
    ? [preferredPort, ...CANDIDATE_PORTS.filter((p) => p !== preferredPort)]
    : CANDIDATE_PORTS;

  const alive = [];
  for (const port of portsToCheck) {
    const url = `http://localhost:${port}`;
    try {
      const res = await hit(url + "/", { timeout: 300 });
      if (res.status && res.status !== 0) {
        alive.push({ port, url });
      }
    } catch {}
  }
  return { preferred: preferredPort, alive };
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
  let targetUrl = options.port ? `http://localhost:${options.port}` : options.url;
  if (targetUrl) {
    targetUrl = normalizeTargetUrl(targetUrl);
    console.log(chalk.cyan(`  Target specified: ${targetUrl}`));
  } else {
    process.stdout.write(chalk.dim("  Scanning ports (5000, 3000, 5173, 8000, 8080...) for live app... "));
    const { preferred, alive } = await detectLocalServer(root);
    if (alive.length > 0) {
      const chosen = (preferred && alive.find((a) => a.port === preferred)) || alive[0];
      targetUrl = chosen.url;
      console.log(chalk.green(`Connected to ${targetUrl}!`));
      if (alive.length > 1) {
        console.log(chalk.dim(`  (Note: Other active ports detected: ${alive.map((a) => a.port).join(", ")}. Pass --port <number> to switch)`));
      }
    } else {
      console.log(chalk.yellow("No live server detected."));
      console.log(chalk.dim("  (Tip: Start your dev server and pass --port <port> e.g. --port 5000 to include live attack probes)"));
    }
  }

  let attackRes = null;
  if (targetUrl) {
    console.log(chalk.dim(`  Attacking ${targetUrl} (probing auth, cookies, CORS, rate limits, XSS, SQLi)...`));
    try {
      attackRes = await runAttack(targetUrl, { path: root, token: options.token, samples: options.samples || 5 });
      console.log(chalk.green(`  ✔ Dynamic probes complete! Tested ${attackRes.routes.length} discovered routes.`));
    } catch (e) {
      console.log(chalk.red(`  ✖ Could not attack ${targetUrl}: ${e.message}`));
    }
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
