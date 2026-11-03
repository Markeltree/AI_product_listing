// Text helpers for user and AI input.

// Collapses whitespace, trims, and cuts to `max` characters.
export function clean(value, max = 500) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

// Accepts an array or a comma/semicolon/newline separated string and returns clean, non-empty items.
export function splitList(value) {
  const items = Array.isArray(value) ? value : String(value ?? '').split(/[,\n;]/);
  return items.map((v) => clean(v, 80)).filter(Boolean);
}
