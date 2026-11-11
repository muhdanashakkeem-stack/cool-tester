# Cool-Tester

**Autonomous AI Software Testing & Security Agent**

Cool-Tester works alongside Vibe Coder through MCP to automate code analysis, bug detection, security testing, ethical hacking, performance optimisation, and final verification.

**One Command. Automated Testing. Smarter & Safer Software.**

---

## ⚡ Quick Start: The One-Command Pipeline

Run the entire autonomous testing, ethical hacking, and performance audit pipeline in one command:

```bash
npm run audit
# or: npx cool-tester audit .
```

### What Happens When You Run `audit`:
1. **Phase 1: Code & Folder Analysis** — Reads project architecture, audits files (JS/TS, HTML, CSS, SQL, PHP, Go), detects hardcoded API keys, verifies `.env` protection.
2. **Phase 2: Auto-Discovery & Ethical Local Probe** — Auto-detects live dev servers on common ports (3000, 5173, 8000, 8080...), strictly attacks `localhost` for Auth bypass, Rate limits, XSS, and SQL injection.
3. **Phase 3: Performance & Latency Benchmarks** — Profiles API speed, p50 and p95 route latency, detects slow endpoints.
4. **Phase 4: The 12 Locks Evaluation** — Scores your codebase against The 12 Locks (+2 Bonus).
5. **Phase 5: Interactive HTML Dashboard** — Generates `.cool-tester/dashboard.html` for visual progress and score breakdown.
6. **Phase 6: AI Remediation Fix Prompt** — Emits step-by-step fix instructions ready to copy into your AI coding agent.

---

## 🛠️ CLI Commands

| Command | Description |
| :--- | :--- |
| `cool-tester audit [path]` | **One-command full pipeline** (static scan, local ethical attack, speed, 12 locks & HTML dashboard) |
| `cool-tester check [path]` | Scan code, Git commit history, and `.gitignore` setup |
| `cool-tester fix [path]` | Automatically create or update `.gitignore` to protect `.env` secrets |
| `cool-tester locks [path]` | Score application against The 12 Locks (`--how` for manual tests) |
| `cool-tester attack <url>` | Safely probe local app on `localhost` (Auth, CORS, Rate Limit, XSS, SQLi, Speed) |
| `cool-tester report [path]` | Show latest combined report (`--fix-prompt` for AI prompt, `--json` for raw output) |
| `cool-tester verify [path]` | Re-run only previously failed checks to confirm all doors are locked |
| `cool-tester mcp` | Start Model Context Protocol server for AI coding agents |

---

## 🤖 Connect to AI Coding Agents via MCP (Worldwide Setup)

Anyone in the world can connect **Cool-Tester** directly into their favorite AI agent (**Claude Code**, **Cursor**, **Antigravity**, **VS Code**, **Windsurf**, or **Claude Desktop**) without installing anything manually!

### 🌍 Universal Setup (Zero-Install via GitHub / NPX)

#### 1. Claude Code
Run in your terminal:
```bash
claude mcp add cool-tester npx -y github:muhdanashakkeem-stack/cool-tester mcp
```

#### 2. Cursor / Windsurf
Go to **Settings** ➔ **Features** ➔ **MCP** ➔ **Add Server**:
- **Name:** `cool-tester`
- **Type:** `command` (or `stdio`)
- **Command:** `npx -y github:muhdanashakkeem-stack/cool-tester mcp`

#### 3. Antigravity / VS Code / Claude Desktop / Gemini CLI
Add this to your MCP configuration file (`mcp_config.json` or `claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "cool-tester": {
      "command": "npx",
      "args": ["-y", "github:muhdanashakkeem-stack/cool-tester", "mcp"]
    }
  }
}
```

---

### 💻 Local Setup (If you cloned the repository)

If you are developing locally inside the cloned repository:

```bash
# Claude Code:
claude mcp add cool-tester node ./bin/cool-tester.js mcp

# Or in your mcp_config.json:
{
  "mcpServers": {
    "cool-tester": {
      "command": "node",
      "args": ["./bin/cool-tester.js", "mcp"]
    }
  }
}
```

---

### 💬 How to Talk to Your AI Agent

Once connected, you don't even need the CLI! Just say to your AI:
> *"Audit my project with cool-tester, attack my local dev server on port 5000, and fix any security vulnerabilities."*

Your AI will autonomously:
1. Call `audit_project` (or `check_code` + `start_attack`).
2. Discover open doors, secret leaks, missing auth, and rate limits.
3. Automatically patch the code and write secure configurations.
4. Call `verify_fix` to confirm 100% of the 12 Locks are secured!

### Tools Exposed to Your AI Agent:
- `audit_project`: Complete autonomous pipeline in one call (scan + attack + 12 locks + dashboard).
- `check_code`: Static security and secret leak scanner.
- `start_attack`: Dynamic localhost ethical probes and latency benchmarks.
- `lock_report`: 12 Locks status evaluator.
- `get_fix_prompt`: Step-by-step remediation plan for AI self-healing.
- `verify_fix`: Verification loop to confirm resolved vulnerabilities.

---

## 🛡️ Privacy, Safety & Legal Guarantees

- **100% Offline & Free:** Runs locally on your machine. No cloud telemetry, no API keys, no fees.
- **Never Reads `.env` Secrets:** Confirms whether `.env` is safely ignored and uncommitted without ever opening or reading the secrets inside.
- **Zero-Leak Secret Masking:** Discovered keys are always masked (`sk-p****`). Never exposes production credentials in terminal or AI prompts.
- **Strict Localhost Safety Lock:** Refuses to attack anything other than `localhost`, `127.0.0.1`, or `::1`. It is strictly a defensive developer tool with zero legal risk.
