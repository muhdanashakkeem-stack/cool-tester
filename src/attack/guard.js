// SAFETY: Cool Tester only ever attacks your own computer.
const LOCAL = new Set(["localhost", "127.0.0.1", "::1"]);

export function normalizeTargetUrl(urlOrPort) {
  if (!urlOrPort) return null;
  let str = String(urlOrPort).trim();
  // If user passed just a port number e.g. "5000" or 5000
  if (/^\d{2,5}$/.test(str)) {
    return `http://localhost:${str}`;
  }
  // If user passed e.g. ":5000"
  if (/^:\d{2,5}$/.test(str)) {
    return `http://localhost${str}`;
  }
  // If user passed e.g. "localhost:5000" or "127.0.0.1:5000"
  if (/^(localhost|127\.0\.0\.1|::1)(:\d+)?(\/.*)?$/i.test(str)) {
    return `http://${str}`;
  }
  return str;
}

export function assertLocal(rawUrl) {
  const url = normalizeTargetUrl(rawUrl);
  let u;
  try { u = new URL(url); } catch { throw new Error(`Invalid URL: ${rawUrl}`); }
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!/^https?:$/.test(u.protocol)) throw new Error("Only http/https URLs are allowed.");
  if (!LOCAL.has(host)) {
    throw new Error(`REFUSED: Cool Tester only attacks localhost, 127.0.0.1 or ::1. "${host}" is not local. Attacking servers you do not own is illegal.`);
  }
  return u;
}
