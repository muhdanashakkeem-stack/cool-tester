import { hit, seenCookies } from "./http.js";
import { loadRules } from "../scanner.js";
import { mask } from "../mask.js";

const F = (group, id, severity, route, issue, why, fix, evidence = "") => ({
  id, severity, type: group === "speed" ? "speed" : "attack", route, file: route, line: 0, issue,
  evidence_masked: evidence, why_it_matters: why, how_to_fix: fix, verify_test_id: group
});
const isPrivate = (p) => /\/(api|admin|dashboard|account|users?|me|profile|orders?|private|settings)(\/|$)/i.test(p)
  && !/(login|signin|signup|register|logout|health|status|public)/i.test(p) && !/^\/api\/?$/.test(p);
const isLogin = (p) => /(login|signin|auth)/i.test(p);
const getRoutes = (ctx) => ctx.routes.filter((r) => r.methods.includes("GET") && !/\.(js|css|png|ico|svg|map)$/i.test(r.path));
const LEAK = /(\bat\s+[\w.<>$ ]+\s*\(?(?:\/|[A-Z]:\\)[^\s)]*:\d+|node_modules|Traceback \(most recent|ENOENT|\/home\/|\/var\/www|C:\\Users)/i;
const SQLERR = /(sqlite_error|sql syntax|syntax error at or near|unclosed quotation|mysql_fetch|pg_query|ORA-\d{4,5}|SQLSTATE)/i;
const pct = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))];

export const TESTS = [
  { id: "headers", async run({ base }) {
    const r = await hit(base + "/");
    const h = r.headers, out = [];
    if (!h.get("content-security-policy")) out.push(F("headers", "ATK-H1", "medium", "/", "No Content-Security-Policy header",
      "If an attacker injects a script into a page, nothing stops it from running and stealing user data.",
      "Add a Content-Security-Policy header (with helmet in Express, or headers() in next.config.js)."));
    if (!h.get("x-frame-options") && !/frame-ancestors/.test(h.get("content-security-policy") || "")) out.push(F("headers", "ATK-H2", "medium", "/", "Page can be put inside another site's frame (clickjacking)",
      "An attacker can overlay your page on their site and trick users into clicking hidden buttons.", "Add X-Frame-Options: DENY or CSP frame-ancestors 'none'."));
    if (h.get("x-content-type-options") !== "nosniff") out.push(F("headers", "ATK-H3", "low", "/", "Missing X-Content-Type-Options: nosniff",
      "Browsers may treat uploaded files as scripts.", "Add X-Content-Type-Options: nosniff (helmet does this)."));
    if (h.get("x-powered-by")) out.push(F("headers", "ATK-H4", "low", "/", `Server reveals its technology (${h.get("x-powered-by")})`,
      "Tells attackers exactly which known bugs to try.", "Remove X-Powered-By (app.disable('x-powered-by') or helmet)."));
    return out;
  } },

  { id: "cors", async run({ base, routes }) {
    const targets = ["/", ...routes.filter((r) => isPrivate(r.path)).map((r) => r.path)].slice(0, 6);
    const out = [];
    for (const p of targets) {
      const r = await hit(base + p, { headers: { Origin: "https://evil.example" } });
      const acao = r.headers.get("access-control-allow-origin"), cred = r.headers.get("access-control-allow-credentials");
      if (acao === "https://evil.example" && cred === "true") out.push(F("cors", "ATK-C1", "high", p, "API trusts any website AND allows cookies",
        "A malicious website can read your logged-in users' private data from your API.", "Allow only your own domains in the CORS origin list.", `Origin evil.example → allowed with credentials`));
      else if (acao === "*" ) out.push(F("cors", "ATK-C2", isPrivate(p) ? "medium" : "low", p, "CORS allows every website (*)",
        "Any website can call this route from a visitor's browser.", "Set CORS origin to your own domain list.", "Access-Control-Allow-Origin: *"));
    }
    return out;
  } },

  { id: "cookies", async run({ base, routes = [] }) {
    if (seenCookies.length === 0 && base) {
      const candidates = ["/", ...routes.map((r) => r.path).filter((p) => /(login|auth|session|account|api)/i.test(p)).slice(0, 5)];
      for (const p of candidates) {
        await hit(base + p);
      }
    }
    const seen = new Map(), out = [];
    for (const { cookie, url } of seenCookies) seen.set(cookie.split("=")[0], { cookie, url });
    for (const [name, { cookie, url }] of seen) {
      let route = "/";
      try { route = new URL(url).pathname; } catch {}
      if (!/httponly/i.test(cookie)) out.push(F("cookies", "ATK-K1", "medium", route, `Cookie "${name}" readable by scripts (no HttpOnly)`,
        "Any injected script can steal this cookie and take over the user's session.", "Set HttpOnly on session cookies."));
      if (!/samesite/i.test(cookie)) out.push(F("cookies", "ATK-K2", "low", route, `Cookie "${name}" has no SameSite`,
        "Other sites can trigger requests with the user's cookie (CSRF).", "Set SameSite=Lax or Strict."));
    }
    return out;
  } },

  { id: "auth", async run({ base, routes, token }) {
    const out = [];
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
    for (const r of routes.filter((r) => isPrivate(r.path)).slice(0, 15)) {
      const res = await hit(base + r.path);
      if (res.status === 200 && res.text.trim().length > 2 && !/<form[^>]*>[\s\S]*password/i.test(res.text)) {
        out.push(F("auth", "ATK-A1", "high", r.path, "Route answers without any login",
          "Anyone on the internet can read this data or use this feature without an account.",
          "Add an auth check (session or token) to this route and return 401 when it is missing.", `GET ${r.path} → ${res.status} with no credentials`));
      } else if (token && (res.status === 401 || res.status === 403)) {
        const authRes = await hit(base + r.path, { headers: authHeaders });
        if (authRes.status === 401 || authRes.status === 403) {
          out.push(F("auth", "ATK-A2", "medium", r.path, "Protected route rejects provided auth token",
            "Supplied demo token cannot access protected route; check token format or permissions.",
            "Verify token authorization logic and ensure token header is accepted.", `GET ${r.path} → ${authRes.status} with provided token`));
        }
      }
    }
    return out;
  } },

  { id: "ratelimit", async run({ base, routes }) {
    const out = [];
    const burst = (url, opts) => Promise.all(Array.from({ length: 30 }, () => hit(url, opts)));
    for (const r of routes.filter((r) => isLogin(r.path)).slice(0, 3)) {
      const res = await burst(base + r.path, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "demo@cool-tester.local", password: "wrong-password-123" }) });
      if (res.some((x) => x.status) && !res.some((x) => x.status === 429)) out.push(F("ratelimit", "ATK-R1", "high", r.path, "Login has no rate limit",
        "An attacker can try thousands of passwords per minute.", "Add rate limiting (express-rate-limit or your host's WAF): about 5 tries per minute per IP.", "30 rapid wrong logins, no 429 response"));
    }
    const priv = routes.find((r) => isPrivate(r.path));
    if (priv) {
      const res = await burst(base + priv.path);
      if (res.some((x) => x.status) && !res.some((x) => x.status === 429)) out.push(F("ratelimit", "ATK-R2", "low", priv.path, "API has no rate limit",
        "A script can hammer this route to scrape data or run up your bill.", "Add a general rate limit to API routes.", "30 rapid requests, no 429 response"));
    }
    return out;
  } },

  { id: "inject", async run({ base, routes }) {
    const out = [];
    for (const r of getRoutes(ctx(routes)).slice(0, 15)) {
      const x = await hit(`${base}${r.path}?q=${encodeURIComponent("<script>vg</script>")}&search=${encodeURIComponent("<script>vg</script>")}&name=${encodeURIComponent("<script>vg</script>")}`);
      if (x.text.includes("<script>vg</script>") && /html/i.test(x.headers.get("content-type") || ""))
        out.push(F("inject", "ATK-I1", "high", r.path, "Page repeats user input as raw HTML (XSS)",
          "An attacker can send a link that runs their script in your user's browser and steals the session.", "Escape output (use your framework's templating) and never insert query text as HTML.", "Test script tag was returned unescaped"));
      const s = await hit(`${base}${r.path}?id=${encodeURIComponent("1'")}&q=${encodeURIComponent("1'")}&search=${encodeURIComponent("1'")}`);
      if (SQLERR.test(s.text)) out.push(F("inject", "ATK-I2", "high", r.path, "Database error shown after a quote character (likely SQL injection)",
        "An attacker can change your database query to read, change or delete all data.", "Use parameterized queries and return a generic error message.", s.text.slice(0, 100)));
    }
    return out;
  } },

  { id: "errors", async run({ base, routes }) {
    const out = [];
    const probes = [["/cool-tester-404-check", {}]];
    for (const r of routes.filter((r) => r.path.startsWith("/api")).slice(0, 5))
      probes.push([r.path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{bad json" }]);
    for (const [p, o] of probes) {
      const r = await hit(base + p, o);
      if (LEAK.test(r.text)) out.push(F("errors", "ATK-E1", "medium", p, "Error page leaks file paths or stack trace",
        "Shows attackers your folder layout and libraries, which makes targeted attacks easier.", "Return a generic error message in production and log details on the server only.", r.text.slice(0, 100).replace(/\n/g, " ")));
    }
    return out;
  } },

  { id: "speed", async run({ base, routes, samples = 20 }) {
    const out = [];
    for (const r of getRoutes({ routes }).slice(0, 15)) {
      const times = [];
      for (let i = 0; i < samples; i++) { const x = await hit(base + r.path); if (x.status) times.push(x.ms); }
      if (times.length < 3) continue;
      const p50 = Math.round(pct(times, 0.5)), p95 = Math.round(pct(times, 0.95));
      if (p95 > 2000) out.push(F("speed", "ATK-S2", "high", r.path, `Very slow route (p95 ${p95}ms)`,
        "Slow routes are easy to overload: a few requests can take your app down.", "Add caching, indexes or pagination; move heavy work to a background job.", `p50 ${p50}ms, p95 ${p95}ms`));
      else if (p95 > 500) out.push(F("speed", "ATK-S1", "medium", r.path, `Slow route (p95 ${p95}ms)`,
        "Slow routes hurt users and are easier to overload.", "Check database queries, add caching or pagination.", `p50 ${p50}ms, p95 ${p95}ms`));
    }
    return out;
  } }
];
function ctx(routes) { return { routes }; }

const CRED = /^(password|passwd|pwd|pass_?hash|password_?hash|hashed_?password|hash|salt|secret|token|access_?token|refresh_?token|api_?key|private_?key|card_?number|cvv|ssn)$/i;
const PERSONAL = /^(phone|mobile|address|dob|birth_?date|national_?id|ip_?address|card_?last4)$/i;
function keysOf(v, depth = 0, out = new Set()) {
  if (depth > 3 || v == null) return out;
  if (Array.isArray(v)) { v.slice(0, 3).forEach((x) => keysOf(x, depth + 1, out)); return out; }
  if (typeof v === "object") for (const [k, x] of Object.entries(v)) { out.add(k); keysOf(x, depth + 1, out); }
  return out;
}

export const EXTRA_TESTS = [
  { id: "keys", async run({ base, routes }) {
    // Same as View Source + Ctrl+F for sk_ / key: reads the page, its scripts and GET routes.
    const rules = loadRules().filter((r) => r.kind === "secret" && !["SEC010", "SEC011", "SEC012"].includes(r.id));
    const pages = new Map();
    const home = await hit(base + "/");
    pages.set("/", home.text);
    for (const m of [...home.text.matchAll(/src=["'](\/[^"']+\.js)["']/g)].slice(0, 8)) pages.set(m[1], (await hit(base + m[1])).text);
    for (const r of getRoutes({ routes }).slice(0, 10)) if (!pages.has(r.path)) pages.set(r.path, (await hit(base + r.path)).text);
    const out = [], seen = new Set();
    for (const [route, text] of pages) for (const r of rules) {
      for (const m of text.slice(0, 2_000_000).matchAll(new RegExp(r.regex, "g" + (r.flags || "")))) {
        if (seen.has(r.id + m[0])) continue;
        seen.add(r.id + m[0]);
        out.push(F("keys", "ATK-X1", "critical", route, `${r.name} visible in what the browser downloads`,
          "Anyone can open View Source, copy this key and use it on your bill.",
          "Move it to a server-side env var, call the service from your own server, then rotate the key by hand in the provider's dashboard.", mask(m[0])));
      }
    }
    return out;
  } },

  { id: "exposure", async run({ base, routes }) {
    // Looks at the field NAMES in JSON responses (never the values).
    const out = [];
    for (const r of getRoutes({ routes }).slice(0, 15)) {
      const res = await hit(base + r.path);
      if (res.status !== 200) continue;
      let json; try { json = JSON.parse(res.text); } catch { continue; }
      const keys = [...keysOf(json)];
      const cred = keys.filter((k) => CRED.test(k) || /password|_hash$/i.test(k)), personal = keys.filter((k) => PERSONAL.test(k));
      if (cred.length) out.push(F("exposure", "ATK-D1", "high", r.path, "API response contains secret-looking fields",
        "Attackers read fields the screen hides: password hashes, tokens, card data.",
        "Return only the fields the screen needs (select them explicitly) and never hashes or tokens.", `fields: ${cred.join(", ")}`));
      if (personal.length) out.push(F("exposure", "ATK-D2", "medium", r.path, "API response contains personal data fields",
        "Phone, address and similar fields may be more than this screen needs.",
        "Check each field is shown on screen; remove the rest from the response.", `fields: ${personal.join(", ")}`));
    }
    return out;
  } }
];
TESTS.push(...EXTRA_TESTS);

