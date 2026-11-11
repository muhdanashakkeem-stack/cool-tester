// Shannon entropy: random-looking strings score high, words and placeholders score low.
export function entropy(str) {
  if (!str) return 0;
  const freq = {};
  for (const ch of str) freq[ch] = (freq[ch] || 0) + 1;
  return -Object.values(freq).reduce((s, n) => {
    const p = n / str.length;
    return s + p * Math.log2(p);
  }, 0);
}

const PLACEHOLDER = /(your|example|placeholder|changeme|xxxx|todo|dummy|sample|<.+>|\*{3,}|\$\{)/i;
export const isPlaceholder = (v) => PLACEHOLDER.test(v);
