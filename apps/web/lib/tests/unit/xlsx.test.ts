import { readSheet } from 'read-excel-file/node';
import { describe, expect, it } from 'vitest';
import { toXlsxBuffer, xlsxFilename } from '../../xlsx';

// read-excel-file (unlike the exceljs reader this suite used previously) only exposes plain cell
// values, not styling/column-width metadata — so there's no automated check here for "the header
// is actually bold" or "the column width was actually capped at 40", only that generating a
// pathologically long value doesn't throw and still round-trips its data correctly.
describe('toXlsxBuffer', () => {
  it('writes a real, readable .xlsx workbook with a header row and data rows', async () => {
    const buffer = await toXlsxBuffer('Report', ['Name', 'Amount'], [['Jane Doe', 5000], ['John Smith', 2500]]);
    const rows = await readSheet(buffer);

    expect(rows).toEqual([
      ['Name', 'Amount'],
      ['Jane Doe', 5000],
      ['John Smith', 2500]
    ]);
  });

  it('produces a valid, empty-but-headed sheet when there are no rows', async () => {
    const buffer = await toXlsxBuffer('Report', ['Name', 'Amount'], []);
    const rows = await readSheet(buffer);

    expect(rows).toEqual([['Name', 'Amount']]);
  });

  it('does not throw and still produces a valid file for a very long value', async () => {
    const longValue = 'x'.repeat(200);
    const buffer = await toXlsxBuffer('Report', ['Note'], [[longValue]]);
    const rows = await readSheet(buffer);

    expect(rows).toEqual([['Note'], [longValue]]);
  });
});

describe('xlsxFilename', () => {
  it('appends .xlsx', () => {
    expect(xlsxFilename('billing-report')).toBe('billing-report.xlsx');
  });

  it('strips characters unsafe for a filename/header', () => {
    expect(xlsxFilename('report 2026/09"; evil')).toBe('report-2026-09---evil.xlsx');
  });
});
