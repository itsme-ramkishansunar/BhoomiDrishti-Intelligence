/**
 * Normalises text received from CSV/JSON/API inputs so literal escaped Unicode
 * sequences from upstream systems do not leak into the visible UI.
 * Example: a literal escaped sequence is decoded before display.
 */
export function decodeLiteralUnicode(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

export function normaliseDisplayText(value) {
  return decodeLiteralUnicode(String(value ?? ''))
    .replace(/\u00A0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}
