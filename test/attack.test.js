import test from "node:test";
import assert from "node:assert";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { start } from "../test-fixtures/vuln-app/server.js";
import { attack } from "../src/attack/index.js";
import { runAttack, verify, audit } from "../src/api.js";

test("refuses to attack anything that is not localhost", async () => {
  for (const u of ["http://example.com", "https://8.8.8.8", "http://localhost.evil.com", "http://127.0.0.1.evil.com"])
    await assert.rejects(attack(u), /REFUSED/, u);
});

test("catches the weaknesses in the vulnerable demo app", async () => {
  const s = await start(0);
  try {
    const r = await attack(`http://localhost:${s.address().port}`, { samples: 4 });
    const ids = new Set(r.findings.map((f) => f.id));
    for (const id of ["ATK-H1", "ATK-H2", "ATK-C2", "ATK-K1", "ATK-A1", "ATK-R1", "ATK-I1", "ATK-I2", "ATK-E1", "ATK-S1", "ATK-X1", "ATK-D1", "ATK-D2"]) assert.ok(ids.has(id), id);
    assert.ok(r.summary.score < 50);
    // never put response data in the report for open routes
    assert.ok(!JSON.stringify(r).includes("alice@example.com") && !JSON.stringify(r).includes("sk_live_1234567890abcdefghijk") && !JSON.stringify(r).includes("x9f"));
  } finally { s.close(); }
});

test("full loop: attack, then verify says still failing", async () => {
  const s = await start(0), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ct-"));
  try {
    const url = `http://localhost:${s.address().port}`;
    await runAttack(url, { path: tmp, samples: 3 });
    const v = await verify(tmp);
    assert.ok(v.counts.still_failing > 5);
    assert.strictEqual(v.counts.fixed, 0);
  } finally { s.close(); }
});

test("a hardened app gets zero findings (no false alarms)", async () => {
  const hits = {};
  const secure = http.createServer((req, res) => {
    const p = new URL(req.url, "http://x").pathname;
    const key = req.method + p; hits[key] = (hits[key] || 0) + 1;
    const h = { "Content-Security-Policy": "default-src 'self'", "X-Frame-Options": "DENY", "X-Content-Type-Options": "nosniff" };
    if (p === "/") { res.writeHead(200, { ...h, "Content-Type": "text/html", "Set-Cookie": "sid=abc; HttpOnly; SameSite=Lax; Path=/" }); return res.end('<a href="/api/data">d</a><a href="/login">l</a>'); }
    if (p === "/api/data") { if (hits[key] > 10) { res.writeHead(429, h); return res.end("slow down"); } res.writeHead(401, { ...h, "Content-Type": "application/json" }); return res.end('{"error":"login required"}'); }
    if (p === "/login") { if (req.method === "POST" && hits[key] > 5) { res.writeHead(429, h); return res.end("slow down"); } res.writeHead(req.method === "POST" ? 401 : 200, { ...h, "Content-Type": "text/html" }); return res.end("<form><input type=password name=password></form>"); }
    res.writeHead(404, h); res.end("Not found");
  });
  await new Promise((r) => secure.listen(0, "127.0.0.1", r));
  try {
    const r = await attack(`http://localhost:${secure.address().port}`, { samples: 4 });
    assert.deepStrictEqual(r.findings.map((f) => f.id + " " + f.route), []);
  } finally { secure.close(); }
});

test("unified audit runs static check, dynamic attack and generates html dashboard", async () => {
  const s = await start(0);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ct-audit-"));
  fs.writeFileSync(path.join(tmp, "app.js"), "const x = 1;\n");
  try {
    const url = `http://localhost:${s.address().port}`;
    const res = await audit(tmp, { url, samples: 2 });
    assert.ok(res.code && res.attack && res.locks);
    assert.ok(fs.existsSync(res.dashboardHtml));
    const html = fs.readFileSync(res.dashboardHtml, "utf8");
    assert.ok(html.includes("Cool Tester Dashboard"));
  } finally { s.close(); }
});
