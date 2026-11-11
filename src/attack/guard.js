// SAFETY: Cool Tester only ever attacks your own computer.
const LOCAL = new Set(["localhost", "127.0.0.1", "::1"]);

export function assertLocal(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error(`Invalid URL: ${url}`); }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!/^https?:$/.test(u.protocol)) throw new Error("Only http/https URLs are allowed.");
  if (!LOCAL.has(host)) {
    throw new Error(`REFUSED: Cool Tester only attacks localhost, 127.0.0.1 or ::1. "${host}" is not local. Attacking servers you do not own is illegal.`);
  }
  return u;
}
