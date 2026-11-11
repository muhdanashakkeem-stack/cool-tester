// Never print a full secret. Show the first 4 characters only.
export function mask(value) {
  if (!value) return "";
  const v = String(value).trim();
  if (v.length <= 4) return "****";
  return v.slice(0, 4) + "****";
}
