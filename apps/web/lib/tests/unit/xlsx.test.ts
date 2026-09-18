import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { toXlsxBuffer, xlsxFilename } from '../../xlsx';

async function readBack(buffer: Buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets[0]!;
}

describe('toXlsxBuffer', () => {
  it('writes a real, readable .xlsx workbook with a header row and data rows', async () => {
    const buffer = await toXlsxBuffer('Report', ['Name', 'Amount'], [['Jane Doe', 5000], ['John Smith', 2500]]);
    const sheet = await readBack(buffer);

    expect(sheet.name).toBe('Report');
    expect(sheet.getRow(1).getCell(1).value).toBe('Name');
    expect(sheet.getRow(1).getCell(2).value).toBe('Amount');
    expect(sheet.getRow(2).getCell(1).value).toBe('Jane Doe');
    expect(sheet.getRow(2).getCell(2).value).toBe(5000);
    expect(sheet.getRow(3).getCell(1).value).toBe('John Smith');
  });

  it('bolds the header row', async () => {
    const buffer = await toXlsxBuffer('Report', ['Name'], [['Jane Doe']]);
    const sheet = await readBack(buffer);

    expect(sheet.getRow(1).font?.bold).toBe(true);
    expect(sheet.getRow(2).font?.bold).toBeFalsy();
  });

  it('produces a valid, empty-but-headed sheet when there are no rows', async () => {
    const buffer = await toXlsxBuffer('Report', ['Name', 'Amount'], []);
    const sheet = await readBack(buffer);

    expect(sheet.getRow(1).getCell(1).value).toBe('Name');
    expect(sheet.rowCount).toBe(1);
  });

  it('caps column width rather than letting one long value blow it out', async () => {
    const longValue = 'x'.repeat(200);
    const buffer = await toXlsxBuffer('Report', ['Note'], [[longValue]]);
    const sheet = await readBack(buffer);

    expect(sheet.getColumn(1).width).toBeLessThanOrEqual(40);
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
