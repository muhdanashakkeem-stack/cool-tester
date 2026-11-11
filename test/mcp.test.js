import test from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("MCP server lists tools and runs check_code", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ct-mcp-"));
  fs.cpSync(path.join(root, "test-fixtures", "multi-lang"), tmp, { recursive: true });
  const child = spawn(process.execPath, [path.join(root, "bin", "cool-tester.js"), "mcp"], { cwd: tmp });
  let buf = ""; const waiters = [];
  child.stdout.on("data", (d) => {
    buf += d; let i;
    while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.trim()) waiters.splice(0).forEach((w) => w(JSON.parse(line))); }
  });
  const send = (m) => child.stdin.write(JSON.stringify(m) + "\n");
  const next = () => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("MCP timeout")), 15000); waiters.push((m) => { clearTimeout(t); res(m); }); });
  try {
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "t", version: "1" } } });
    assert.strictEqual((await next()).result.serverInfo.name, "cool-tester");
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const names = (await next()).result.tools.map((t) => t.name).sort();
    assert.deepStrictEqual(names, ["audit_project", "check_code", "get_fix_prompt", "get_report", "lock_report", "start_attack", "verify_fix"]);
    send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "check_code", arguments: { path: tmp } } });
    const res = JSON.parse((await next()).result.content[0].text);
    assert.ok(res.summary.high > 0 && Object.keys(res.stats.byLang).length === 6);
    send({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "start_attack", arguments: { url: "http://example.com" } } });
    const refused = (await next()).result;
    assert.ok(refused.isError && /REFUSED/.test(refused.content[0].text));
  } finally { child.kill(); }
});
