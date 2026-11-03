// Text helpers for user and AI input.
//
// XSS: listing text is shown by the app as plain text, sent to Etsy as plain text, and sent to eBay
// as HTML (escaped in ebay/api.js). As a second line of defence, HTML tags, script/style blocks and
// control characters are removed from every text value before it is stored. Text that only looks
// like a comparison ("size < 5 cm", "<3") is kept.

const SCRIPT_BLOCKS = /<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const HTML_TAGS = /<\/?[a-z!][^<>]*>/gi;
// Control characters except tab and newline (and the line separators some editors paste in).
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u2028\u2029]/g;

export function stripHtml(value) {
  return String(value ?? '').replace(SCRIPT_BLOCKS, '').replace(HTML_TAGS, '').replace(CONTROL_CHARS, '');
}

// Single-line text: strips HTML, collapses whitespace, trims, and cuts to `max` characters.
export function clean(value, max = 500) {
  return stripHtml(value).replace(/\s+/g, ' ').trim().slice(0, max);
}

// Multi-line text (descriptions): strips HTML, keeps line breaks, removes trailing spaces on each line
// and runs of more than one blank line.
export function cleanMultiline(value, max = 10000) {
  return stripHtml(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

// Accepts an array or a comma/semicolon/newline separated string and returns clean, non-empty items.
export function splitList(value) {
  const items = Array.isArray(value) ? value : String(value ?? '').split(/[,\n;]/);
  return items.map((v) => clean(v, 80)).filter(Boolean);
}
