import fs from "node:fs";
import path from "node:path";

export function generateHtmlDashboard(root, { fullReport, locksReport, prompt }) {
  const summary = fullReport.summary || { score: 100, critical: 0, high: 0, medium: 0, low: 0 };
  const score = summary.score ?? 100;
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  const gradeColor = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  const findings = fullReport.findings || [];
  const locks = locksReport.locks || [];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cool Tester — Security & Speed Dashboard</title>
  <style>
    :root {
      --bg: #0f172a; --card: #1e293b; --border: #334155; --text: #f8fafc; --muted: #94a3b8;
      --critical: #ef4444; --high: #f97316; --medium: #eab308; --low: #38bdf8; --clean: #10b981;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 2rem 1rem; line-height: 1.5; }
    .container { max-width: 1200px; margin: 0 auto; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
    .title-area h1 { font-size: 1.8rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; }
    .title-area p { color: var(--muted); font-size: 0.9rem; margin-top: 0.25rem; }
    .score-badge { display: flex; align-items: center; gap: 1rem; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 0.75rem 1.5rem; }
    .score-circle { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 900; background: ${gradeColor}22; color: ${gradeColor}; border: 3px solid ${gradeColor}; }
    .score-details .score-val { font-size: 1.25rem; font-weight: 700; }
    .score-details .score-lbl { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }

    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem; }
    .stat-card.critical { border-left: 4px solid var(--critical); }
    .stat-card.high { border-left: 4px solid var(--high); }
    .stat-card.medium { border-left: 4px solid var(--medium); }
    .stat-card.low { border-left: 4px solid var(--low); }
    .stat-num { font-size: 2rem; font-weight: 800; line-height: 1; }
    .stat-lbl { color: var(--muted); font-size: 0.85rem; margin-top: 0.5rem; text-transform: uppercase; }

    .section-title { font-size: 1.3rem; font-weight: 700; margin: 2rem 0 1rem; display: flex; align-items: center; gap: 0.5rem; }
    .locks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; margin-bottom: 2.5rem; }
    .lock-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 1rem 1.25rem; }
    .lock-card.open { border-left: 4px solid var(--critical); }
    .lock-card.pass { border-left: 4px solid var(--clean); }
    .lock-card.confirm { border-left: 4px solid var(--clean); }
    .lock-card.by_hand { border-left: 4px solid var(--medium); }
    .lock-card.not_tested { border-left: 4px solid var(--muted); opacity: 0.75; }
    .lock-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem; }
    .lock-title { font-weight: 600; font-size: 0.95rem; }
    .lock-status { font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; text-transform: uppercase; }
    .st-open { background: #ef444433; color: #f87171; }
    .st-clean { background: #10b98133; color: #34d399; }
    .st-hand { background: #eab30833; color: #facc15; }
    .st-untested { background: #64748b33; color: #94a3b8; }
    .lock-check { font-size: 0.8rem; color: var(--muted); margin-top: 0.5rem; }

    .findings-list { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2.5rem; }
    .finding-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem; }
    .finding-card.sev-critical { border-left: 4px solid var(--critical); }
    .finding-card.sev-high { border-left: 4px solid var(--high); }
    .finding-card.sev-medium { border-left: 4px solid var(--medium); }
    .finding-card.sev-low { border-left: 4px solid var(--low); }
    .finding-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem; }
    .finding-title { font-size: 1.05rem; font-weight: 700; }
    .badges { display: flex; gap: 0.5rem; }
    .badge { font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: 4px; text-transform: uppercase; }
    .badge-sev-critical { background: var(--critical); color: #fff; }
    .badge-sev-high { background: var(--high); color: #fff; }
    .badge-sev-medium { background: var(--medium); color: #000; }
    .badge-sev-low { background: var(--low); color: #000; }
    .badge-type { background: #334155; color: #cbd5e1; }
    .finding-where { font-family: ui-monospace, monospace; font-size: 0.85rem; color: #38bdf8; margin-bottom: 0.5rem; }
    .finding-evidence { background: #090d16; padding: 0.6rem 0.8rem; border-radius: 6px; font-family: ui-monospace, monospace; font-size: 0.8rem; margin: 0.5rem 0; overflow-x: auto; color: #facc15; }
    .finding-risk { font-size: 0.9rem; color: #cbd5e1; margin-top: 0.4rem; }
    .finding-fix { font-size: 0.9rem; color: #34d399; margin-top: 0.4rem; font-weight: 500; }

    .prompt-box { background: #090d16; border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem; position: relative; }
    .prompt-box pre { font-family: ui-monospace, monospace; font-size: 0.85rem; white-space: pre-wrap; word-break: break-word; color: #e2e8f0; }
    .copy-btn { position: absolute; top: 1rem; right: 1rem; background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.8rem; }
    .copy-btn:hover { background: #2563eb; }
    footer { text-align: center; color: var(--muted); font-size: 0.85rem; margin-top: 3rem; border-top: 1px solid var(--border); padding-top: 1.5rem; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="title-area">
        <h1>😎 Cool Tester Dashboard</h1>
        <p>Offline Security &amp; Speed Audit • 100% Local • Zero API Keys</p>
      </div>
      <div class="score-badge">
        <div class="score-circle">${grade}</div>
        <div class="score-details">
          <div class="score-val">${score} / 100</div>
          <div class="score-lbl">Security Score</div>
        </div>
      </div>
    </header>

    <div class="summary-grid">
      <div class="stat-card critical">
        <div class="stat-num" style="color: var(--critical);">${summary.critical}</div>
        <div class="stat-lbl">Critical Issues</div>
      </div>
      <div class="stat-card high">
        <div class="stat-num" style="color: var(--high);">${summary.high}</div>
        <div class="stat-lbl">High Issues</div>
      </div>
      <div class="stat-card medium">
        <div class="stat-num" style="color: var(--medium);">${summary.medium}</div>
        <div class="stat-lbl">Medium Issues</div>
      </div>
      <div class="stat-card low">
        <div class="stat-num" style="color: var(--low);">${summary.low}</div>
        <div class="stat-lbl">Low Issues</div>
      </div>
    </div>

    <div class="section-title">🔒 The 12 Locks (+2 Bonus)</div>
    <div class="locks-grid">
      ${locks.map((L) => {
        const stClass = L.status === "open" ? "st-open" : L.status === "pass" || L.status === "confirm" ? "st-clean" : L.status === "by_hand" ? "st-hand" : "st-untested";
        const stText = L.status === "open" ? "OPEN" : L.status === "pass" ? "CLEAN" : L.status === "confirm" ? "NONE FOUND" : L.status === "by_hand" ? "BY HAND" : "NOT TESTED";
        return `
        <div class="lock-card ${L.status}">
          <div class="lock-header">
            <span class="lock-title">#${L.lock} ${escapeHtml(L.name)}</span>
            <span class="lock-status ${stClass}">${stText}</span>
          </div>
          <div class="lock-check"><strong>Verification:</strong> ${escapeHtml(L.check_by_hand)}</div>
          ${L.findings && L.findings.length ? `<div style="font-size:0.75rem; color:#f87171; margin-top:0.4rem;">${L.findings.length} issue(s) detected</div>` : ""}
        </div>`;
      }).join("")}
    </div>

    <div class="section-title">🚨 Vulnerability &amp; Performance Findings (${findings.length})</div>
    <div class="findings-list">
      ${findings.length === 0 ? `<div style="color: #34d399; font-weight:600; padding:1.5rem; background:var(--card); border-radius:10px;">✔ Zero vulnerabilities found! Your app is clean.</div>` : ""}
      ${findings.map((f) => `
        <div class="finding-card sev-${f.severity}">
          <div class="finding-top">
            <span class="finding-title">${escapeHtml(f.issue)}</span>
            <div class="badges">
              <span class="badge badge-sev-${f.severity}">${f.severity}</span>
              <span class="badge badge-type">${f.type}</span>
            </div>
          </div>
          <div class="finding-where">📍 ${escapeHtml(f.file || f.route || "")}${f.line ? ":" + f.line : ""}</div>
          ${f.evidence_masked ? `<div class="finding-evidence">${escapeHtml(f.evidence_masked)}</div>` : ""}
          <div class="finding-risk"><strong>Why it matters:</strong> ${escapeHtml(f.why_it_matters)}</div>
          <div class="finding-fix"><strong>How to fix:</strong> ${escapeHtml(f.how_to_fix)}</div>
        </div>
      `).join("")}
    </div>

    <div class="section-title">🤖 AI Agent Remediation Fix Plan</div>
    <div class="prompt-box">
      <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('prompt-text').innerText); this.innerText = 'Copied!'; setTimeout(() => this.innerText = 'Copy Prompt', 2000);">Copy Prompt</button>
      <pre id="prompt-text">${escapeHtml(prompt || "")}</pre>
    </div>

    <footer>
      Generated locally by Cool Tester • Ready for Cursor, Claude Code, Antigravity, and Gemini
    </footer>
  </div>
</body>
</html>`;

  const outDir = path.join(root, ".cool-tester");
  fs.mkdirSync(outDir, { recursive: true });
  const htmlPath = path.join(outDir, "dashboard.html");
  fs.writeFileSync(htmlPath, html, "utf8");
  return htmlPath;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
