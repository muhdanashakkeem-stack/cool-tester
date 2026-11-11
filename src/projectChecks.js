import fs from "node:fs";
import path from "node:path";
import { staticRoutes } from "./attack/discover.js";

const JS_VALIDATORS = ["zod", "joi", "yup", "express-validator", "class-validator", "ajv", "valibot", "superstruct", "@sinclair/typebox"];

// Heuristic: the app accepts data but no validation library is installed.
export function projectChecks(root) {
  const writes = staticRoutes(root).filter(([, m]) => ["POST", "PUT", "PATCH", "DELETE"].includes(m));
  if (!writes.length) return [];
  const pkg = path.join(root, "package.json"), req = path.join(root, "requirements.txt");
  let file, ok;
  if (fs.existsSync(pkg)) {
    file = "package.json";
    try { const j = JSON.parse(fs.readFileSync(pkg, "utf8")); const d = { ...j.dependencies, ...j.devDependencies }; ok = JS_VALIDATORS.some((v) => v in d); } catch { return []; }
  } else if (fs.existsSync(req)) {
    file = "requirements.txt";
    ok = /pydantic|marshmallow|cerberus|wtforms|voluptuous|django|fastapi/i.test(fs.readFileSync(req, "utf8"));
  } else return [];
  if (ok) return [];
  return [{ id: "VAL001", severity: "medium", file, line: 0, category: "backend",
    issue: "No server-side validation library found, but the app accepts data",
    evidence_masked: `${writes.length} write routes, e.g. ${writes[0][1]} ${writes[0][0]}`,
    why_it_matters: "Browser limits (maxlength, required) can be skipped; without server checks anything can be sent.",
    how_to_fix: "Validate every request on the server with a schema (zod, joi, pydantic) and reject extra fields." }];
}
