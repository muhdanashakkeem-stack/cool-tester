import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import chalk from "chalk";

export function serveDashboard(root = process.cwd(), port = 3333, openBrowser = true) {
  const dashboardPath = path.join(root, ".cool-tester", "dashboard.html");
  if (!fs.existsSync(dashboardPath)) {
    throw new Error(`Dashboard file not found at ${dashboardPath}. Run 'cool-tester audit' first to generate it.`);
  }

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    fs.createReadStream(dashboardPath).pipe(res);
  });

  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log(chalk.green(`\n📊 Cool-Tester Dashboard live at: `) + chalk.bold.cyan(url));
    console.log(chalk.dim(`Serving ${dashboardPath}`));
    console.log(chalk.dim(`Press Ctrl+C to stop.\n`));

    if (openBrowser) {
      const startCmd = process.platform === "win32" ? `start ${url}` : process.platform === "darwin" ? `open ${url}` : `xdg-open ${url}`;
      exec(startCmd, () => {});
    }
  });

  return server;
}
