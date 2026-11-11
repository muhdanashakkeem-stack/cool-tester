import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const isEnvFile = (name) =>
  /^\.env(\..+)?$/.test(name) && !/\.(example|sample|template)$/.test(name);

function git(root, args) {
  try {
    return execFileSync("git", args, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString();
  } catch { return null; }
}

function make(id, severity, file, line, issue, why, fix) {
  return { id, severity, file, line, issue, evidence_masked: "", why_it_matters: why, how_to_fix: fix };
}

// Checks .env handling: gitignore, committed .env, .env in wrong folder.
export function checkEnv(root, envFilesFound) {
  const findings = [];
  const hasGit = fs.existsSync(path.join(root, ".git"));
  const giPath = path.join(root, ".gitignore");
  const gi = fs.existsSync(giPath) ? fs.readFileSync(giPath, "utf8") : null;
  const ignoresEnv = gi !== null && gi.split("\n").some((l) => /^\/?\.env(\*|\.\*)?\s*$/.test(l.trim()));

  if (gi === null && (hasGit || envFilesFound.length)) {
    findings.push(make("ENV001", "high", ".gitignore", 0, "No .gitignore file",
      "Without .gitignore, `git add .` will upload .env and node_modules.",
      "Create .gitignore containing: .env, .env.*, !.env.example, node_modules/"));
  }
  if (gi !== null && !ignoresEnv && envFilesFound.length) {
    findings.push(make("ENV002", "critical", ".gitignore", 0, ".env exists but is not in .gitignore",
      "Your next `git push` will publish your secrets.",
      "Add `.env` and `.env.*` to .gitignore, then rotate any key that was already pushed."));
  }

  if (hasGit) {
    const tracked = git(root, ["ls-files"]);
    for (const f of (tracked || "").split("\n").filter(Boolean)) {
      if (isEnvFile(path.basename(f))) {
        findings.push(make("ENV003", "critical", f, 0, ".env file is committed to git",
          "Secrets in git stay in history even after you delete the file.",
          `Run \`git rm --cached ${f}\`, add it to .gitignore, and rotate every key inside it.`));
      }
    }
  }

  for (const f of envFilesFound) {
    const top = f.split(path.sep)[0];
    if (f.includes(path.sep) && ["public", "src", "static", "www", "client", "app", "pages"].includes(top)) {
      findings.push(make("ENV004", "high", f, 0, ".env file in a web-served or source folder",
        "Files in public/static folders can be downloaded by anyone through the browser.",
        "Move .env to the project root and make sure it is never served."));
    }
  }
  return findings;
}

export function fixEnv(root = process.cwd()) {
  const giPath = path.join(root, ".gitignore");
  const envRules = "\n# Environment variables\n.env\n.env.*\n!.env.example\nnode_modules/\n";
  if (!fs.existsSync(giPath)) {
    fs.writeFileSync(giPath, envRules.trimStart(), "utf8");
    return { created: true, message: "Created .gitignore with .env rules" };
  }
  const gi = fs.readFileSync(giPath, "utf8");
  const ignoresEnv = gi.split("\n").some((l) => /^\/?\.env(\*|\.\*)?\s*$/.test(l.trim()));
  if (!ignoresEnv) {
    fs.writeFileSync(giPath, gi + envRules, "utf8");
    return { updated: true, message: "Appended .env rules to existing .gitignore" };
  }
  return { already_fixed: true, message: ".gitignore already protects .env" };
}
