import fs from "node:fs";
import path from "node:path";

export function generateHtmlDashboard(root, { fullReport, locksReport, prompt }) {
  const summary = fullReport.summary || { score: 100, critical: 0, high: 0, medium: 0, low: 0 };
  const score = summary.score ?? 100;
  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";
  const gradeColor = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  const findings = fullReport.findings || [];
  const locks = locksReport.locks || [];
  const cleanLocks = locks.filter((l) => l.status === "pass" || l.status === "confirm").length;
  const openLocks = locks.filter((l) => l.status === "open").length;
  const handLocks = locks.filter((l) => l.status === "by_hand").length;
  const lockProgress = locks.length ? Math.round((cleanLocks / locks.length) * 100) : 100;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cool Tester Dashboard — Autonomous AI Security & Speed</title>
  <style>
    :root {
      --bg: #090d16;
      --surface: #111827;
      --card: rgba(17, 24, 39, 0.75);
      --card-hover: rgba(30, 41, 59, 0.85);
      --border: rgba(51, 65, 85, 0.6);
      --border-glow: rgba(56, 189, 248, 0.3);
      --text: #f8fafc;
      --muted: #94a3b8;
      --critical: #ef4444;
      --high: #f97316;
      --medium: #eab308;
      --low: #38bdf8;
      --clean: #10b981;
      --primary: #6366f1;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
    body {
      background: var(--bg);
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.15), transparent 50%),
        radial-gradient(circle at 80% 20%, rgba(56, 189, 248, 0.08), transparent 40%);
      color: var(--text);
      padding: 2.5rem 1.5rem;
      line-height: 1.6;
      min-height: 100vh;
    }
    .container { max-width: 1240px; margin: 0 auto; }
    
    /* Top Bar */
    .top-nav {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1.25rem;
    }
    .brand-title { display: flex; align-items: center; gap: 0.75rem; }
    .brand-badge {
      background: linear-gradient(135deg, #4f46e5, #06b6d4);
      padding: 0.35rem 0.75rem;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
    }
    .brand-title h1 { font-size: 1.85rem; font-weight: 800; letter-spacing: -0.02em; }
    .brand-desc { color: var(--muted); font-size: 0.9rem; margin-top: 0.2rem; }

    /* Score Badge */
    .score-container {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      background: var(--card);
      backdrop-filter: blur(12px);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 0.85rem 1.5rem;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    }
    .score-ring {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.6rem;
      font-weight: 900;
      background: ${gradeColor}22;
      color: ${gradeColor};
      border: 3px solid ${gradeColor};
      box-shadow: 0 0 20px ${gradeColor}44;
    }
    .score-meta .score-number { font-size: 1.35rem; font-weight: 800; }
    .score-meta .score-label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; font-weight: 600; }

    /* Summary Stat Cards */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2.5rem;
    }
    .stat-card {
      background: var(--card);
      backdrop-filter: blur(10px);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.4rem;
      transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
      position: relative;
      overflow: hidden;
    }
    .stat-card:hover {
      transform: translateY(-3px);
      border-color: rgba(255,255,255,0.2);
      box-shadow: 0 12px 24px rgba(0,0,0,0.3);
    }
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; width: 4px; height: 100%;
    }
    .stat-card.critical::before { background: var(--critical); box-shadow: 0 0 12px var(--critical); }
    .stat-card.high::before { background: var(--high); box-shadow: 0 0 12px var(--high); }
    .stat-card.medium::before { background: var(--medium); box-shadow: 0 0 12px var(--medium); }
    .stat-card.low::before { background: var(--low); box-shadow: 0 0 12px var(--low); }
    .stat-card.clean::before { background: var(--clean); box-shadow: 0 0 12px var(--clean); }
    .stat-val { font-size: 2.3rem; font-weight: 800; line-height: 1; }
    .stat-name { color: var(--muted); font-size: 0.85rem; font-weight: 600; margin-top: 0.5rem; text-transform: uppercase; letter-spacing: 0.04em; }

    /* Sections */
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 2.5rem 0 1.25rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .section-title { font-size: 1.35rem; font-weight: 800; display: flex; align-items: center; gap: 0.6rem; }
    
    /* Locks Progress Bar */
    .locks-progress-box {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.2rem;
      margin-bottom: 1.5rem;
    }
    .progress-bar-wrap {
      width: 100%;
      height: 10px;
      background: #1e293b;
      border-radius: 999px;
      overflow: hidden;
      margin-top: 0.6rem;
      display: flex;
    }
    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #10b981, #06b6d4);
      border-radius: 999px;
      transition: width 0.6s ease;
    }
    .locks-meta-line { display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 600; color: var(--muted); }

    /* Locks Grid */
    .locks-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 1.25rem;
      margin-bottom: 3rem;
    }
    .lock-card {
      background: var(--card);
      backdrop-filter: blur(8px);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.2rem;
      transition: border-color 0.2s ease, transform 0.2s ease;
    }
    .lock-card:hover {
      border-color: rgba(255,255,255,0.2);
      transform: translateY(-2px);
    }
    .lock-card.open { border-left: 4px solid var(--critical); }
    .lock-card.pass, .lock-card.confirm { border-left: 4px solid var(--clean); }
    .lock-card.by_hand { border-left: 4px solid var(--medium); }
    .lock-card.not_tested { border-left: 4px solid var(--muted); opacity: 0.75; }
    .lock-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; }
    .lock-title { font-weight: 700; font-size: 0.95rem; }
    .lock-status { font-size: 0.7rem; font-weight: 800; padding: 0.25rem 0.6rem; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
    .st-open { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
    .st-clean { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .st-hand { background: rgba(234, 179, 8, 0.2); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.4); }
    .st-untested { background: rgba(100, 116, 139, 0.2); color: #cbd5e1; border: 1px solid rgba(100, 116, 139, 0.4); }
    .lock-check { font-size: 0.8rem; color: var(--muted); margin-top: 0.5rem; line-height: 1.4; }

    /* Interactive Findings Filter Bar */
    .filter-bar {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 1.25rem;
    }
    .filter-btn {
      background: var(--card);
      border: 1px solid var(--border);
      color: var(--muted);
      padding: 0.4rem 0.85rem;
      border-radius: 8px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .filter-btn.active, .filter-btn:hover {
      background: #1e293b;
      color: #fff;
      border-color: #64748b;
    }
    .search-input {
      background: var(--card);
      border: 1px solid var(--border);
      color: #fff;
      padding: 0.45rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      outline: none;
      min-width: 240px;
      margin-left: auto;
    }
    .search-input:focus { border-color: var(--primary); }

    /* Findings List */
    .findings-list { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 3rem; }
    .finding-card {
      background: var(--card);
      backdrop-filter: blur(8px);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.4rem;
      transition: all 0.2s ease;
    }
    .finding-card:hover {
      border-color: rgba(255,255,255,0.25);
      background: var(--card-hover);
    }
    .finding-card.sev-critical { border-left: 5px solid var(--critical); }
    .finding-card.sev-high { border-left: 5px solid var(--high); }
    .finding-card.sev-medium { border-left: 5px solid var(--medium); }
    .finding-card.sev-low { border-left: 5px solid var(--low); }
    .finding-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.6rem; }
    .finding-title { font-size: 1.1rem; font-weight: 700; color: #fff; }
    .badge-group { display: flex; gap: 0.5rem; }
    .badge {
      font-size: 0.7rem;
      font-weight: 800;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-sev-critical { background: var(--critical); color: #fff; }
    .badge-sev-high { background: var(--high); color: #fff; }
    .badge-sev-medium { background: var(--medium); color: #000; }
    .badge-sev-low { background: var(--low); color: #000; }
    .badge-type { background: #334155; color: #cbd5e1; }
    .finding-path { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85rem; color: #38bdf8; margin-bottom: 0.5rem; }
    .finding-evidence {
      background: #060911;
      border: 1px solid #1e293b;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-family: ui-monospace, monospace;
      font-size: 0.82rem;
      color: #facc15;
      overflow-x: auto;
      margin: 0.6rem 0;
    }
    .finding-desc { font-size: 0.9rem; color: #cbd5e1; margin-top: 0.4rem; }
    .finding-fix { font-size: 0.92rem; color: #34d399; margin-top: 0.4rem; font-weight: 600; display: flex; align-items: baseline; gap: 0.4rem; }

    /* AI Remediation Box */
    .prompt-box-wrap {
      background: #060911;
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 1.5rem;
      position: relative;
      margin-bottom: 3rem;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    }
    .prompt-box-wrap pre {
      font-family: ui-monospace, SFMono-Regular, monospace;
      font-size: 0.85rem;
      white-space: pre-wrap;
      word-break: break-word;
      color: #e2e8f0;
      max-height: 400px;
      overflow-y: auto;
    }
    .copy-action-btn {
      position: absolute;
      top: 1.25rem;
      right: 1.25rem;
      background: linear-gradient(135deg, #4f46e5, #06b6d4);
      color: #fff;
      border: none;
      padding: 0.55rem 1.2rem;
      border-radius: 8px;
      font-weight: 700;
      font-size: 0.85rem;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .copy-action-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(79, 70, 229, 0.6);
    }

    footer {
      text-align: center;
      color: var(--muted);
      font-size: 0.85rem;
      border-top: 1px solid var(--border);
      padding: 2rem 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <header class="top-nav">
      <div class="brand-title">
        <span class="brand-badge">Autonomous Co-Pilot</span>
        <div>
          <h1>😎 Cool Tester Dashboard</h1>
          <p class="brand-desc">Offline Security, Ethical Hack &amp; Latency Audit • 100% Local • Zero API Keys</p>
        </div>
      </div>
      <div class="score-container">
        <div class="score-ring">${grade}</div>
        <div class="score-meta">
          <div class="score-number">${score} / 100</div>
          <div class="score-label">Security Health</div>
        </div>
      </div>
    </header>

    <div class="summary-grid">
      <div class="stat-card critical">
        <div class="stat-val" style="color: var(--critical);">${summary.critical}</div>
        <div class="stat-name">Critical Issues</div>
      </div>
      <div class="stat-card high">
        <div class="stat-val" style="color: var(--high);">${summary.high}</div>
        <div class="stat-name">High Priority</div>
      </div>
      <div class="stat-card medium">
        <div class="stat-val" style="color: var(--medium);">${summary.medium}</div>
        <div class="stat-name">Medium Issues</div>
      </div>
      <div class="stat-card low">
        <div class="stat-val" style="color: var(--low);">${summary.low}</div>
        <div class="stat-name">Low / Informative</div>
      </div>
      <div class="stat-card clean">
        <div class="stat-val" style="color: var(--clean);">${cleanLocks} / ${locks.length}</div>
        <div class="stat-name">Locks Secured</div>
      </div>
    </div>

    <!-- The 12 Locks Section -->
    <div class="section-header">
      <div class="section-title">🔒 The 12 Locks (+2 Bonus) Scorecard</div>
    </div>
    <div class="locks-progress-box">
      <div class="locks-meta-line">
        <span>Lock Protection Rate</span>
        <span>${lockProgress}% Secured (${cleanLocks} clean, ${openLocks} open, ${handLocks} to verify)</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width: ${lockProgress}%;"></div>
      </div>
    </div>

    <div class="locks-grid">
      ${locks.map((L) => {
        const stClass = L.status === "open" ? "st-open" : L.status === "pass" || L.status === "confirm" ? "st-clean" : L.status === "by_hand" ? "st-hand" : "st-untested";
        const stText = L.status === "open" ? "OPEN" : L.status === "pass" ? "CLEAN" : L.status === "confirm" ? "NONE FOUND" : L.status === "by_hand" ? "BY HAND" : "NOT TESTED";
        return `
        <div class="lock-card ${L.status}">
          <div class="lock-top">
            <span class="lock-title">#${L.lock} ${escapeHtml(L.name)}</span>
            <span class="lock-status ${stClass}">${stText}</span>
          </div>
          <div class="lock-check"><strong>Verification:</strong> ${escapeHtml(L.check_by_hand)}</div>
          ${L.findings && L.findings.length ? `<div style="font-size:0.75rem; color:#f87171; font-weight:700; margin-top:0.4rem;">✖ ${L.findings.length} issue(s) detected</div>` : ""}
        </div>`;
      }).join("")}
    </div>

    <!-- Findings Section -->
    <div class="section-header">
      <div class="section-title">🚨 Detected Findings (${findings.length})</div>
    </div>

    <div class="filter-bar">
      <button class="filter-btn active" onclick="filterSev('all', this)">All (${findings.length})</button>
      <button class="filter-btn" onclick="filterSev('critical', this)">Critical (${summary.critical})</button>
      <button class="filter-btn" onclick="filterSev('high', this)">High (${summary.high})</button>
      <button class="filter-btn" onclick="filterSev('medium', this)">Medium (${summary.medium})</button>
      <button class="filter-btn" onclick="filterSev('low', this)">Low (${summary.low})</button>
      <input type="text" class="search-input" id="searchBox" placeholder="Search route, issue, or keyword..." oninput="searchFindings()">
    </div>

    <div class="findings-list" id="findingsContainer">
      ${findings.length === 0 ? `<div style="color: #34d399; font-weight:700; padding:2rem; background:var(--card); border:1px solid var(--clean); border-radius:12px; text-align:center;">🎉 Zero security vulnerabilities detected! Your project is locked tight.</div>` : ""}
      ${findings.map((f) => `
        <div class="finding-card sev-${f.severity}" data-severity="${f.severity}" data-text="${escapeHtml((f.issue + ' ' + (f.file || f.route || '') + ' ' + (f.why_it_matters || '')).toLowerCase())}">
          <div class="finding-header">
            <span class="finding-title">${escapeHtml(f.issue)}</span>
            <div class="badge-group">
              <span class="badge badge-sev-${f.severity}">${f.severity}</span>
              <span class="badge badge-type">${f.type}</span>
            </div>
          </div>
          <div class="finding-path">📍 ${escapeHtml(f.file || f.route || "")}${f.line ? ":" + f.line : ""}</div>
          ${f.evidence_masked ? `<div class="finding-evidence">${escapeHtml(f.evidence_masked)}</div>` : ""}
          <div class="finding-desc"><strong>Risk:</strong> ${escapeHtml(f.why_it_matters)}</div>
          <div class="finding-fix"><span>💡</span> <strong>Remediation:</strong> ${escapeHtml(f.how_to_fix)}</div>
        </div>
      `).join("")}
    </div>

    <!-- AI Remediation Fix Prompt -->
    <div class="section-header">
      <div class="section-title">🤖 AI Agent Remediation Fix Plan</div>
    </div>
    <div class="prompt-box-wrap">
      <button class="copy-action-btn" onclick="copyPrompt(this)">📋 Copy AI Prompt</button>
      <pre id="promptText">${escapeHtml(prompt || "")}</pre>
    </div>

    <footer>
      Generated locally by Cool Tester • Ready for Cursor, Claude Code, Antigravity, and Gemini
    </footer>
  </div>

  <script>
    function copyPrompt(btn) {
      const text = document.getElementById('promptText').innerText;
      navigator.clipboard.writeText(text);
      btn.innerText = '✔ Copied to Clipboard!';
      setTimeout(() => { btn.innerText = '📋 Copy AI Prompt'; }, 2200);
    }

    function filterSev(sev, btn) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const cards = document.querySelectorAll('.finding-card');
      cards.forEach(c => {
        if (sev === 'all' || c.getAttribute('data-severity') === sev) {
          c.style.display = 'block';
        } else {
          c.style.display = 'none';
        }
      });
    }

    function searchFindings() {
      const q = document.getElementById('searchBox').value.toLowerCase().trim();
      const cards = document.querySelectorAll('.finding-card');
      cards.forEach(c => {
        const text = c.getAttribute('data-text') || '';
        if (!q || text.includes(q)) {
          c.style.display = 'block';
        } else {
          c.style.display = 'none';
        }
      });
    }
  </script>
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
