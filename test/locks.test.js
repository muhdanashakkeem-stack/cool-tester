import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { start } from "../test-fixtures/vuln-app/server.js";
import { check, runAttack, locks } from "../src/api.js";
import { scan } from "../src/scanner.js";

const fx = (n) => path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test-fixtures", n);
const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), "ct-lock-"));
const status = (r, n) => r.locks.find((l) => l.lock === n).status;

test("weak app: every lock is open except git history (no repo here)", async () => {
  const s = await start(0), tmp = tmpdir();
  fs.cpSync(fx("multi-lang"), tmp, { recursive: true });
  try {
    check(tmp);
    await runAttack(`http://localhost:${s.address().port}`, { path: tmp, samples: 3 });
    const r = locks(tmp);
    const closed = r.locks.filter((l) => l.status !== "open").map((l) => l.lock);
    assert.deepStrictEqual(closed, [2], "unexpected closed locks: " + closed);
    assert.ok(r.locks[0].rotate_by_hand && r.locks[2].can_lock_you_out);
  } finally { s.close(); }
});

test("code-only run: attack locks say NOT TESTED, IDOR needs hand check", () => {
  const tmp = tmpdir();
  fs.writeFileSync(path.join(tmp, "index.html"), "<h1>hello</h1>");
  check(tmp);
  const r = locks(tmp);
  assert.strictEqual(status(r, 4), "not_tested");
  assert.strictEqual(status(r, 7), "not_tested");
  assert.strictEqual(status(r, 5), "by_hand");
  assert.ok(["pass", "confirm"].includes(status(r, 1)));
});

test("git history: finds a key that was deleted later, masked", () => {
  const tmp = tmpdir();
  const git = (...a) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: tmp, stdio: "ignore" });
  git("init", "-q");
  fs.writeFileSync(path.join(tmp, "config.js"), 'const k = "sk_live_1234567890abcdefghijk";\n');
  fs.writeFileSync(path.join(tmp, ".env"), "A=1\n");
  git("add", "-A"); git("commit", "-q", "-m", "oops");
  fs.rmSync(path.join(tmp, "config.js")); fs.rmSync(path.join(tmp, ".env"));
  git("add", "-A"); git("commit", "-q", "-m", "removed it");
  const r = scan(tmp);
  assert.ok(r.findings.some((f) => f.id === "GIT001"), "GIT001");
  assert.ok(r.findings.some((f) => f.id === "GIT002"), "GIT002");
  assert.ok(!JSON.stringify(r).includes("sk_live_1234567890abcdefghijk"));
  check(tmp);
  assert.strictEqual(status(locks(tmp), 2), "open");
});
