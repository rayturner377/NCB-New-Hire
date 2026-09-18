import ExcelJS from 'exceljs';

/**
 * A single-sheet .xlsx workbook as a Buffer, ready to hand straight to a NextResponse body.
 * Bold header row + auto-sized columns (based on the longest value actually written, capped so one
 * long note/description doesn't blow a column out to an unreadable width) — everything else about
 * styling is left to whoever opens it, this isn't trying to reproduce report.md's original request
 * for a fully formatted export, just a genuinely-.xlsx file rather than a CSV wearing a costume.
 */
export async function toXlsxBuffer(sheetName: string, headers: string[], rows: (string | number)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(row);
  }

  sheet.columns.forEach((column, index) => {
    const header = headers[index] ?? '';
    const longestValue = rows.reduce((max, row) => Math.max(max, String(row[index] ?? '').length), header.length);
    column.width = Math.min(Math.max(longestValue + 2, 10), 40);
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/** A safe `Content-Disposition` filename, same rule as csv.ts's csvFilename. */
export function xlsxFilename(base: string): string {
  return `${base.replace(/[^a-zA-Z0-9-_]/g, '-')}.xlsx`;
}
