import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scan, meetsThreshold } from "../src/scanner.js";
import { mask } from "../src/mask.js";
import { fixEnv } from "../src/envChecks.js";
import { loadUserIgnore } from "../src/ignore.js";

const fx = (n) => path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "test-fixtures", n);
const ids = (r) => new Set(r.findings.map((f) => f.id));

test("finds code secrets and .env gitignore mistakes without reading .env contents", () => {
  const r = scan(fx("vulnerable"));
  // SEC001, SEC003, SEC004, SEC011 are in src/app.js; ENV002 is .gitignore check; SEC012 in .env is NOT read because .env is never opened
  for (const id of ["SEC001", "SEC003", "SEC004", "SEC011", "ENV002"]) assert.ok(ids(r).has(id), id);
  assert.ok(!r.findings.some((f) => f.file === ".env"), ".env content must never be read");
});
test("does not flag process.env usage", () => assert.ok(!scan(fx("vulnerable")).findings.some((f) => f.evidence_masked.includes("process.env"))));
test("never leaks a full secret", () => {
  const out = JSON.stringify(scan(fx("vulnerable")));
  assert.ok(!out.includes("sk_live_1234567890abcdefghijk") && !out.includes("AKIAIOSFODNN7EXAMPLE"));
});
test("mask keeps 4 chars", () => assert.strictEqual(mask("sk-abcdefgh"), "sk-a****"));
test("fail-on threshold", () => {
  assert.ok(meetsThreshold(scan(fx("vulnerable")).summary, "critical"));
  assert.ok(!meetsThreshold({ critical: 0, high: 0, medium: 1, low: 0, score: 95 }, "high"));
});

const WANT = {
  html: "FE004 FE005 FE006 FE007 FE008 FE009 SP008",
  css: "CSS001 CSS002 CSS003",
  js: "FE001 FE002 FE003 FE011 BE004 BE005 BE006 BE009 BE011 SP001 SP002 SP007 BE012 BE013 UP001",
  sql: "SQL001 SQL002 SQL004 SQL005 SQL006 SQL007 SQL008 SP010",
  php: "PHP001 PHP002 PHP003 PHP004 PHP005 PHP006 PHP007 HASH01",
  go: "GO001 GO002 GO003 GO004 GO005 GO006 GO007 GO008"
};
test("reads supported code languages and skips Python (.py)", () => {
  const r = scan(fx("multi-lang"));
  assert.deepStrictEqual(Object.keys(r.stats.byLang).sort(), Object.keys(WANT).sort());
  assert.ok(!("py" in r.stats.byLang), "Python files must be skipped");
  for (const [lang, list] of Object.entries(WANT))
    for (const id of list.split(" ")) assert.ok(r.findings.some((f) => f.id === id && f.lang === lang), `${lang}:${id}`);
});
test("reports folder structure error when directory has no readable code or does not exist", () => {
  const missing = scan("/non-existent-path-12345");
  assert.strictEqual(missing.valid_structure, false);
  assert.ok(missing.findings.some((f) => f.id === "STRUCT001"));

  const emptyTmp = fs.mkdtempSync(path.join(os.tmpdir(), "ct-empty-"));
  const emptyRes = scan(emptyTmp);
  assert.strictEqual(emptyRes.valid_structure, false);
  assert.ok(emptyRes.findings.some((f) => f.id === "STRUCT002"));
});

test("safely masks secret even on long lines crossing the 160 char slice boundary", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ct-mask-"));
  const longSecret = "sk-proj-" + "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789".repeat(2);
  const code = " ".repeat(140) + `const k = "${longSecret}";\n`;
  fs.writeFileSync(path.join(tmp, "app.js"), code);
  const r = scan(tmp);
  const finding = r.findings.find((f) => f.id === "SEC001");
  assert.ok(finding, "SEC001 finding exists");
  assert.ok(!finding.evidence_masked.includes("AbCdEfGhIjKlMn"), "Unmasked secret must not appear in evidence_masked");
  assert.ok(finding.evidence_masked.includes("sk-p****"), "Masked prefix must appear");
});

test("fixEnv creates .gitignore if missing and adds .env protection", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ct-fix-"));
  const res1 = fixEnv(tmp);
  assert.strictEqual(res1.created, true);
  const gi1 = fs.readFileSync(path.join(tmp, ".gitignore"), "utf8");
  assert.ok(gi1.includes(".env") && gi1.includes("node_modules/"));

  // Idempotent: running again reports already fixed
  const res2 = fixEnv(tmp);
  assert.strictEqual(res2.already_fixed, true);
});

test("loadUserIgnore correctly matches directory ignore rules on Windows backslashes", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ct-ign-"));
  fs.writeFileSync(path.join(tmp, ".cooltesterignore"), "custom_dir/\n*.tmp\n");
  const ign = loadUserIgnore(tmp);
  assert.ok(ign("custom_dir\\sub\\file.js"), "Matches Windows backslash paths");
  assert.ok(ign("custom_dir/sub/file.js"), "Matches POSIX slash paths");
  assert.ok(ign("data.tmp"), "Matches extension patterns");
  assert.ok(!ign("src\\app.js"), "Does not match non-ignored files");
});
