/**
 * RFC 4180 field quoting — wraps a field in double quotes (doubling any quote inside it) whenever
 * it contains a comma, quote, or newline; left bare otherwise. `\r\n` row separators (also RFC
 * 4180) rather than `\n`, since Excel treats a bare `\n`-only CSV as one giant first row on Windows.
 */
function escapeCsvField(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serializes a header row plus data rows into CSV text. Every row must have the same length as `headers`. */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCsvField).join(',')).join('\r\n');
}

/** A safe `Content-Disposition` filename — strips characters that would break the header or look like a path. */
export function csvFilename(base: string): string {
  return `${base.replace(/[^a-zA-Z0-9-_]/g, '-')}.csv`;
}
