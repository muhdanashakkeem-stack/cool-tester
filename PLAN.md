# Cool Tester — Complete Architecture & Implementation Plan

## 1. Vision & Purpose
**Cool Tester** is a 100% offline security and performance testing tool built for **Vibe Coders**. It runs locally via Node.js, connects to AI coding agents (Claude Code, Cursor, Antigravity, Gemini, ChatGPT) through the **Model Context Protocol (MCP)**, audits codebases against **The 12 Locks (+2 Bonus)**, detects leaked API keys in frontend/backend code and Git history, and actively probes local servers (`localhost`) like an ethical hacker.

---

## 2. Strict Privacy & Code-Reading Rules
1. **Never Read `.env` Contents:** The scanner checks whether `.env` exists and is properly listed in `.gitignore` (and never committed to Git), but **never** opens or reads `.env` file contents.
2. **Code-Only Scanning:** Automatically skips `node_modules`, `.next`, `out`, `dist`, `build`, `venv`, `.venv`, `__pycache__`, and Python (`.py`) files.
3. **Git History Inspection:** Scans commit history (`git log`) to catch API keys or `.env` files that were committed in the past and later deleted.
4. **Folder Structure Validation:** Immediately returns `valid_structure: false` and clear structure error codes (`STRUCT001` / `STRUCT002`) to the frontend and AI agent if the folder path is invalid or contains no readable source code.
5. **Secret Masking:** All detected keys are masked to show only the first 4 characters (`sk-a****`).

---

## 3. Core Architecture

```text
cool-tester/
├── PLAN.md               # Complete product & technical plan
├── README.md             # Quick-start guide and CLI reference
├── package.json          # CLI bin ("cool-tester") and dependencies
├── .cooltesterignore.example
├── bin/
│   └── cool-tester.js    # CLI entry point (check, attack, report, verify, locks, mcp)
├── src/
│   ├── api.js            # Core programmatic API
│   ├── scanner.js        # Static code scanner + Folder structure validator
│   ├── ignore.js         # Ignore rules (.env, node_modules, .next, .py, etc.)
│   ├── envChecks.js      # .gitignore & git tracking checks for .env
│   ├── gitHistory.js     # Git commit history secret leak scanner
│   ├── entropy.js        # Shannon entropy filter for generic secrets
│   ├── mask.js           # Secret masking utility (first 4 chars only)
│   ├── projectChecks.js  # Project-level schema validation checks
│   ├── locks.js          # The 12 Locks (+2 bonus) evaluation engine
│   ├── mcp.js            # Model Context Protocol (MCP) server for AI agents
│   ├── fixPrompt.js      # AI remediation prompt generator
│   ├── report.js         # Terminal UI formatter
│   ├── state.js          # Local state persistence (.cool-tester/last-report.json)
│   └── attack/           # Localhost active ethical-hacker engine
│       ├── guard.js      # Safety guard (strictly enforces localhost/127.0.0.1)
│       ├── http.js       # Non-redirecting HTTP client with timing & cookie capture
│       ├── discover.js   # Route discovery (Express/Next.js code + live crawl)
│       ├── index.js      # Attack orchestrator
│       └── tests.js      # 10 active probes (Auth, CORS, Rate Limit, XSS, SQLi, Speed, etc.)
├── rules/
│   ├── secrets.json      # API key & frontend exposure regex rules
│   ├── web.json          # Core web vulnerability rules
│   └── lang.json         # Frontend, backend, database, and speed rules
└── test/                 # Automated test suite
    ├── scan.test.js
    ├── attack.test.js
    ├── locks.test.js
    └── mcp.test.js
```

---

## 4. The 12 Locks (+2 Bonus) Security Checklist
1. **Lock 1:** API keys exposed to the browser (`SEC*`, `ATK-X1`)
2. **Lock 2:** Secrets in Git history (`GIT001`, `GIT002`)
3. **Lock 3:** Database readable by anyone with the URL (`SQL005`, `SQL006`, `ATK-A1`)
4. **Lock 4:** Login checked only in the page, not on the server (`ATK-A1`, `GEN002`)
5. **Lock 5:** Change the ID, see someone else's data — IDOR (`BE013`)
6. **Lock 6:** Server trusts the whole request body — Mass Assignment (`BE007`, `BE012`)
7. **Lock 7:** No rate limit on login or API routes (`ATK-R1`, `ATK-R2`)
8. **Lock 8:** Input checked in the browser only (`VAL001`)
9. **Lock 9:** Database queries built from strings — SQL Injection (`WEB006`, `ATK-I2`)
10. **Lock 10:** User content shown as raw HTML — XSS (`WEB003`, `WEB004`, `ATK-I1`)
11. **Lock 11:** Uploads accept anything (`UP001`, `PHP008`)
12. **Lock 12:** API returns the whole record (`ATK-D1`, `ATK-D2`, `SP003`)
13. **Bonus 13:** Error pages show stack traces (`ATK-E1`, `BE003`)
14. **Bonus 14:** CORS open to every website (`ATK-C1`, `ATK-C2`, `WEB005`)

---

## 5. Single-Command Workflow for Vibe Coders

### Step 1: Install & Run Static Check
```bash
npm install
npx cool-tester check .
```

### Step 2: Attack Local Running App (Localhost Only)
```bash
npx cool-tester attack http://localhost:3000 --path .
```

### Step 3: View 12 Locks Status & Generate AI Fix Prompt
```bash
npx cool-tester locks --how
npx cool-tester report --fix-prompt
```

### Step 4: Connect Directly to AI Agents via MCP
Add to your Claude Code / Cursor / Antigravity MCP configuration:
```json
{
  "mcpServers": {
    "cool-tester": {
      "command": "npx",
      "args": ["cool-tester", "mcp"]
    }
  }
}
```
Available MCP Tools:
- `check_code`: Scans project code and validates folder structure.
- `start_attack`: Safely probes localhost routes for auth, CORS, XSS, SQLi, rate limits, and speed.
- `lock_report`: Evaluates the 12 Locks (+2 bonus).
- `get_report`: Returns the full JSON report.
- `get_fix_prompt`: Generates a prioritized fix plan for the AI agent; developer chooses which items to fix.
- `verify_fix`: Re-runs only failed checks to confirm fixes.
