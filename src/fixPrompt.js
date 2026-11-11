export function buildFixPrompt({ findings }) {
  if (!findings.length) return "Cool Tester found no security or speed issues. Nothing to fix.";
  const tag = (f) => (f.type === "attack" ? "ATTACK" : f.type === "speed" ? "SPEED" : "CODE");
  const list = findings.map((f, i) =>
    `${i + 1}. [${f.severity.toUpperCase()}][${tag(f)}] ${f.issue} (${f.file}${f.line ? ":" + f.line : ""})\n   Risk: ${f.why_it_matters}\n   Fix: ${f.how_to_fix}`
  ).join("\n");
  return `Fix these problems found by Cool Tester in this project, most severe first:

${list}

Rules:
- Move every secret into .env, read it with process.env on the server only, and make sure .env is in .gitignore.
- Never expose secrets to frontend code or print them in logs.
- Use parameterized queries, escape output, and add auth checks to every private route.
- You cannot rotate keys yourself. At the end, list every key I must rotate manually, because any key that was committed or pushed must be treated as leaked.
- When done, call the Cool Tester tool verify_fix (or run \`npx cool-tester verify\`) and keep fixing until nothing is still failing.`;
}
