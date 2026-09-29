/**
 * CSV for exports that open in a spreadsheet. Pure; shared by every export.
 *
 * RFC 4180 escaping, so names with commas or quotes survive a round trip.
 * And a text cell that a spreadsheet would read as a formula — something a
 * person typed, like a place name starting with "=" — is prefixed with an
 * apostrophe so it shows as text and never runs (CSV injection).
 */

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers.map(csvCell).join(","), ...rows.map((row) => row.map(csvCell).join(","))].join("\r\n");
}
