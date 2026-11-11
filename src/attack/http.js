import { assertLocal } from "./guard.js";

export const seenCookies = [];
export const resetSeen = () => { seenCookies.length = 0; };

// Every request re-checks the guard and never follows redirects (so we can't be sent off-machine).
export async function hit(url, { method = "GET", headers = {}, body, timeout = 8000 } = {}) {
  const parsed = assertLocal(url);
  const normalizedUrl = parsed.href;
  const t0 = performance.now();
  try {
    const res = await fetch(normalizedUrl, { method, headers, body, redirect: "manual", signal: AbortSignal.timeout(timeout) });
    const text = await res.text();
    const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie()
      : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
    setCookie.forEach((c) => seenCookies.push({ url: normalizedUrl, cookie: c }));
    return { status: res.status, headers: res.headers, text, ms: performance.now() - t0, setCookie };
  } catch (e) {
    // Windows/Node fallback: if "localhost" fails (e.g. ::1 ECONNREFUSED), try 127.0.0.1 (IPv4)
    if (normalizedUrl.includes("localhost")) {
      const fallbackUrl = normalizedUrl.replace("localhost", "127.0.0.1");
      try {
        const res = await fetch(fallbackUrl, { method, headers, body, redirect: "manual", signal: AbortSignal.timeout(timeout) });
        const text = await res.text();
        const setCookie = res.headers.getSetCookie ? res.headers.getSetCookie()
          : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
        setCookie.forEach((c) => seenCookies.push({ url: fallbackUrl, cookie: c }));
        return { status: res.status, headers: res.headers, text, ms: performance.now() - t0, setCookie };
      } catch {}
    }
    return { status: 0, error: e.message, headers: new Headers(), text: "", ms: performance.now() - t0, setCookie: [] };
  }
}
