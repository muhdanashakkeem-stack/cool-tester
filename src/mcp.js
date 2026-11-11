import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { check, runAttack, report, fixPrompt, verify, locks, audit } from "./api.js";

const ok = (data) => ({ content: [{ type: "text", text: typeof data === "string" ? data : JSON.stringify(data, null, 2) }] });
const wrap = (fn) => async (args) => { try { return ok(await fn(args)); } catch (e) { return { isError: true, content: [{ type: "text", text: e.message }] }; } };
const path = z.string().optional().describe("Project folder (default: current folder)");

export async function startMcp() {
  const server = new McpServer({ name: "cool-tester", version: "0.2.0" });
  server.tool("audit_project", "Execute complete autonomous pipeline: static scan, ethical attack, speed test, 12 locks & HTML dashboard.",
    { path, url: z.string().optional().describe("Local app URL (auto-detected if omitted)"), token: z.string().optional() },
    wrap(({ path, url, token }) => audit(path, { url, token })));
  server.tool("check_code", "Read all project code (HTML, CSS, JS/TS, SQL, PHP, Go) and find leaked secrets, security weaknesses and speed problems. Offline.", { path }, wrap(({ path }) => check(path)));
  server.tool("start_attack", "Safely attack the app running on localhost: open routes, CORS, cookies, rate limits, XSS/SQL error probes, error leaks, API speed. Refuses non-local URLs.",
    { url: z.string().describe("Local app URL, e.g. http://localhost:3000"), path, token: z.string().optional().describe("Optional demo-user token"), samples: z.number().optional().describe("Requests per route for the speed test (default 20)") },
    wrap(({ url, path, token, samples }) => runAttack(url, { path, token, samples })));
  server.tool("get_report", "Get the latest combined report (code + attack + speed) as JSON.", { path }, wrap(({ path }) => report(path)));
  server.tool("get_fix_prompt", "Get an ordered fix plan for the AI agent from the latest report.", { path }, wrap(({ path }) => fixPrompt(path)));
  server.tool("verify_fix", "After fixing, re-run only the failed checks and report what is fixed, still failing, or new.", { path, token: z.string().optional() }, wrap(({ path, token }) => verify(path, { token })));
  server.tool("lock_report", "Score the app against the 12 Locks (+2 bonus): which doors are open, clean, need a by-hand check, or are not tested yet.", { path }, wrap(({ path }) => locks(path)));
  await server.connect(new StdioServerTransport());
}
