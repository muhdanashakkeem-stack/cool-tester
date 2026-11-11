// INTENTIONALLY VULNERABLE demo app for testing Cool Tester. Never deploy this.
import http from "node:http";

// Weak code on purpose (never called) so the static check has something to find:
function legacy(q, id) {
  const query = "SELECT * FROM users WHERE id = " + id;
  return eval(q) + query;
}

export function start(port = 0) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const send = (code, body, type = "application/json", extra = {}) => {
      res.writeHead(code, { "Content-Type": type, ...extra });
      res.end(typeof body === "string" ? body : JSON.stringify(body));
    };
    const cors = { "Access-Control-Allow-Origin": "*", "X-Powered-By": "Express" };

    if (url.pathname === "/") {
      return send(200, `<html><body><h1>Demo shop</h1><script>const stripeKey="sk_live_1234567890abcdefghijk";</script>
        <a href="/search?q=hi">search</a> <a href="/api/users">users</a> <a href="/login">login</a>
        <a href="/slow">slow</a> <a href="/dashboard">dashboard</a> <a href="/api/admin">admin</a></body></html>`,
        "text/html", { ...cors, "Set-Cookie": "session=abc123; Path=/" });
    }
    if (url.pathname === "/search") {
      return send(200, `<html><body><h2>Results for ${url.searchParams.get("q") || ""}</h2></body></html>`, "text/html", cors);
    }
    if (url.pathname === "/api/users") {
      if ((url.searchParams.get("id") || "").includes("'"))
        return send(500, { error: 'SQLITE_ERROR: near "\'": syntax error', stack: "Error\n    at Database.all (/home/app/node_modules/sqlite3/lib/db.js:12:3)" }, "application/json", cors);
      return send(200, [{ id: 1, email: "alice@example.com", phone: "555-0101", password_hash: "x9f" }, { id: 2, email: "bob@example.com", phone: "555-0102", password_hash: "y7a" }], "application/json", cors);
    }
    if (url.pathname === "/api/admin") return send(200, { panel: "admin data" }, "application/json", cors);
    if (url.pathname === "/dashboard") return send(200, { orders: [1, 2, 3] }, "application/json", cors);
    if (url.pathname === "/login" && req.method === "POST") return send(401, { error: "invalid credentials" }, "application/json", cors);
    if (url.pathname === "/login") return send(200, `<form method="post"><input name="email"><input type="password" name="password"></form>`, "text/html", cors);
    if (url.pathname === "/slow") return setTimeout(() => send(200, { ok: true }, "application/json", cors), 650);
    return send(404, "Error: Not found\n    at handler (/home/app/server.js:10:5)", "text/plain");
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}

if (process.argv[1] && process.argv[1].endsWith("server.js")) {
  const s = await start(Number(process.env.PORT) || 3000);
  console.log(`Vulnerable demo app on http://localhost:${s.address().port}`);
}
