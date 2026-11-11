import fs from "node:fs";
import path from "node:path";
import { hit } from "./http.js";
import { DEFAULT_IGNORE_DIRS } from "../ignore.js";

const COMMON = ["/api", "/api/users", "/api/user", "/api/me", "/api/admin", "/api/health", "/admin", "/login",
  "/api/login", "/api/auth/login", "/signup", "/dashboard", "/profile", "/api/orders", "/api/settings"];
const ASSET = /\.(js|css|png|jpe?g|gif|svg|ico|woff2?|map|json|txt)$/i;

export async function discover(base, codePath) {
  const routes = new Map();
  const add = (p, method = "GET", source = "probe") => {
    p = p.split("?")[0].split("#")[0];
    if (!p.startsWith("/") || p.length > 120) return;
    const r = routes.get(p) || { path: p, methods: new Set(), source };
    r.methods.add(method);
    routes.set(p, r);
  };

  if (codePath) for (const [p, m] of staticRoutes(codePath)) add(p, m, "code");

  // Crawl the home page and its scripts for links and API calls.
  const home = await hit(base + "/");
  const pages = [home.text];
  const scripts = [...home.text.matchAll(/src=["'](\/[^"']+\.js)["']/g)].map((m) => m[1]).slice(0, 5);
  for (const s of scripts) pages.push((await hit(base + s)).text);
  for (const text of pages) {
    for (const m of text.matchAll(/(?:href|action)=["'](\/[^"'#]*)["']/g)) if (!ASSET.test(m[1].split("?")[0])) add(m[1], "GET", "crawl");
    for (const m of text.matchAll(/["'`](\/api\/[A-Za-z0-9_\-\/]*)["'`]/g)) add(m[1], "GET", "crawl");
  }

  // Probe common paths.
  for (const p of COMMON) {
    if (routes.has(p)) continue;
    const r = await hit(base + p);
    if (r.status && r.status !== 404) add(p, "GET", "probe");
  }
  return [...routes.values()].map((r) => ({ ...r, methods: [...r.methods] }));
}

// Read Express-style and Next.js routes from source code.
export function staticRoutes(root) {
  const out = [];
  const exts = new Set([".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".py"]);
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (DEFAULT_IGNORE_DIRS.has(name)) continue;
      const full = path.join(dir, name);
      let st; try { st = fs.statSync(full); } catch { continue; }
      if (st.isDirectory()) { walk(full); continue; }
      if (!exts.has(path.extname(name))) continue;
      const rel = path.relative(root, full).split(path.sep).join("/");
      const nextApp = rel.match(/(?:^|\/)app\/(.*)\/route\.[jt]sx?$/);
      const nextPages = rel.match(/(?:^|\/)pages\/(api\/.*)\.[jt]sx?$/);
      const hitPath = nextApp ? nextApp[1] : nextPages ? nextPages[1].replace(/\/index$/, "") : null;
      if (hitPath) out.push(["/" + hitPath.replace(/\([^)]*\)\/?/g, "").replace(/\[\.{0,3}[^\]]+\]/g, "1"), "GET"]);
      let text; try { text = fs.readFileSync(full, "utf8"); } catch { continue; }
      // Express/Next.js/FastAPI/Flask routes
      for (const m of text.matchAll(/(?:\b|@)(?:app|router)\.(get|post|put|delete|patch|all)\(\s*["'`](\/[^"'`]*)["'`]/gi))
        out.push([m[2].replace(/:[A-Za-z_]+/g, "1").replace(/\{[A-Za-z0-9_]+\}/g, "1"), m[1].toLowerCase() === "all" ? "GET" : m[1].toUpperCase()]);
    }
  })(path.resolve(root));
  return out;
}
