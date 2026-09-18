import writeXlsxFile from 'write-excel-file/node';

/**
 * A single-sheet .xlsx workbook as a Buffer, ready to hand straight to a NextResponse body.
 * Bold header row + auto-sized columns (based on the longest value actually written, capped so one
 * long note/description doesn't blow a column out to an unreadable width) — everything else about
 * styling is left to whoever opens it, this isn't trying to reproduce report.md's original request
 * for a fully formatted export, just a genuinely-.xlsx file rather than a CSV wearing a costume.
 *
 * write-excel-file over exceljs (used here previously): exceljs's last real release was October
 * 2023 and pins a `uuid` version with an open moderate advisory it's never bumped past (not
 * exploitable the way exceljs itself calls it, but still a permanent `npm audit` finding with no
 * upstream fix available). write-excel-file's only dependency is fflate, a small, actively
 * maintained, zero-dependency library — genuinely audit-clean, not just currently unaffected.
 */
export async function toXlsxBuffer(sheetName: string, headers: string[], rows: (string | number)[][]): Promise<Buffer> {
  const sheetData = [
    headers.map((header) => ({ value: header, fontWeight: 'bold' as const })),
    ...rows.map((row) => row.map((value) => ({ value })))
  ];

  const columns = headers.map((header, index) => {
    const longestValue = rows.reduce((max, row) => Math.max(max, String(row[index] ?? '').length), header.length);
    return { width: Math.min(Math.max(longestValue + 2, 10), 40) };
  });

  return writeXlsxFile(sheetData, { sheet: sheetName, columns }).toBuffer();
}

/** A safe `Content-Disposition` filename, same rule as csv.ts's csvFilename. */
export function xlsxFilename(base: string): string {
  return `${base.replace(/[^a-zA-Z0-9-_]/g, '-')}.xlsx`;
}
