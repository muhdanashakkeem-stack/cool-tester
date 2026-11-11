// The "12 Locks" board (+2 bonus): which common doors AI leaves open, mapped to Cool Tester checks.
// Lock list inspired by "The 12 Locks" by Codikko Academy / Code with MJ. Wording here is our own.
export const GROUPS = { 1: "Secrets & storage", 2: "Access control", 3: "Data in & out", 4: "Bonus" };

export const LOCKS = [
  { n: 1, g: 1, name: "API keys exposed to the browser", signals: ["SEC*", "ATK-X1"], needs: ["code"], also: "attack", mode: "auto", rotate: true,
    byHand: "Open your live site, View Source, search for sk_ / key / secret. Then rotate every exposed key in the provider's dashboard." },
  { n: 2, g: 1, name: "Secrets in git history", signals: ["GIT*"], needs: ["code"], mode: "auto", rotate: true,
    byHand: "Search your history for a key you know used to be there. Rotate every key that ever appeared, public repo or not." },
  { n: 3, g: 1, name: "Database readable by anyone with the URL", signals: ["SQL005", "SQL006", "ATK-A1"], needs: ["code"], also: "attack", mode: "partial", risky: true,
    byHand: "Sign out, open your database's public table URL in a private window: you should get no rows. Then use the app as a normal user." },
  { n: 4, g: 2, name: "Login checked only in the page, not on the server", signals: ["ATK-A1", "GEN002"], needs: ["attack"], mode: "auto",
    byHand: "Sign out and paste an admin/dashboard URL. You must be sent to login. An empty page still means the route ran." },
  { n: 5, g: 2, name: "Change the ID, see someone else's data (IDOR)", signals: ["BE013"], needs: ["code"], mode: "manual",
    byHand: "Make two accounts. As A, put B's ID into a view, edit and delete URL. Each must say not found. (Automatic two-account test is on the roadmap.)" },
  { n: 6, g: 2, name: "Server trusts the whole request body", signals: ["BE007", "BE012", "PY011"], needs: ["code"], mode: "partial", risky: true,
    byHand: "Read each endpoint's allowed-fields list for anything that decides role, price or status. Then edit profile, place order, change a setting." },
  { n: 7, g: 2, name: "No rate limit (guessing and bills)", signals: ["ATK-R1", "ATK-R2"], needs: ["attack"], mode: "auto",
    byHand: "Type a wrong password 10 times fast: you must be slowed or blocked. Then set a monthly spending cap in each paid provider's dashboard." },
  { n: 8, g: 3, name: "Input checked in the browser only", signals: ["VAL001"], needs: ["code"], mode: "partial",
    byHand: "In DevTools delete maxlength/required from a field and submit. The server must reject it." },
  { n: 9, g: 3, name: "Database queries built from strings (SQL injection)", signals: ["WEB006", "PY005", "PHP003", "PHP007", "GO001", "ATK-I2"], needs: ["code"], also: "attack", mode: "partial",
    byHand: "A clean result cannot prove there are none. Ask a fresh AI chat to list string-built queries as a second independent pass." },
  { n: 10, g: 3, name: "User content shown as raw HTML (XSS)", signals: ["WEB003", "WEB004", "FE002", "FE009", "PHP005", "GO007", "PY010", "ATK-I1"], needs: ["code"], also: "attack", mode: "auto",
    byHand: "Post a comment containing <b>test</b> and <script>. It must show as that exact text, not bold and not blank." },
  { n: 11, g: 3, name: "Uploads accept anything", signals: ["PHP008", "UP001", "PY012"], needs: ["code"], mode: "partial", risky: true,
    byHand: "Rename a .txt to .jpg and upload: rejected. Upload a file over the cap: clean error. Check old images still load." },
  { n: 12, g: 3, name: "API returns the whole record", signals: ["ATK-D1", "ATK-D2", "SP003", "SP004"], needs: ["code"], also: "attack", mode: "partial",
    byHand: "F12, Network tab, open a data request, read the Response. Any field not on screen should not be there." },
  { n: 13, g: 4, name: "Error pages show stack traces", signals: ["ATK-E1", "BE003", "PHP006", "WEB008", "PY006"], needs: ["code"], also: "attack", mode: "auto",
    byHand: "Visit a URL that does not exist and submit a broken form on the live site. You must see a plain message, no file paths." },
  { n: 14, g: 4, name: "CORS open to every website", signals: ["ATK-C1", "ATK-C2", "WEB005"], needs: ["code"], also: "attack", mode: "auto",
    byHand: "Read your allowed-origins list: every domain must be one you own and can explain." }
];

const matches = (f, sig) => sig.endsWith("*") ? f.id.startsWith(sig.slice(0, -1)) : f.id === sig;

export function evaluateLocks(findings, ran) {
  return LOCKS.map((L) => {
    const hits = findings.filter((f) => L.signals.some((s) => matches(f, s)));
    const missing = L.needs.filter((k) => !ran[k]);
    let status, note = "";
    if (hits.length) status = "open";
    else if (missing.length) { status = "not_tested"; note = missing[0] === "attack" ? "run: cool-tester attack http://localhost:PORT --path ." : "run: cool-tester check"; }
    else if (L.mode === "manual") status = "by_hand";
    else if (L.mode === "partial") status = "confirm";
    else status = "pass";
    if ((status === "pass" || status === "confirm") && L.also && !ran[L.also]) note = `live app not attacked yet (run: cool-tester attack ...)`;
    return { lock: L.n, group: GROUPS[L.g], name: L.name, status, findings: hits.map((f) => ({ id: f.id, severity: f.severity, where: f.route || f.file, issue: f.issue })),
      rotate_by_hand: !!L.rotate, can_lock_you_out: !!L.risky, check_by_hand: L.byHand, note };
  });
}
