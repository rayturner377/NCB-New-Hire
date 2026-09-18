import { describe, expect, it } from 'vitest';
import { csvFilename, toCsv } from '../../csv';

describe('toCsv', () => {
  it('joins headers and rows with commas and CRLF row separators', () => {
    expect(toCsv(['a', 'b'], [['1', '2'], ['3', '4']])).toBe('a,b\r\n1,2\r\n3,4');
  });

  it('quotes a field containing a comma', () => {
    expect(toCsv(['name'], [['Doe, Jane']])).toBe('name\r\n"Doe, Jane"');
  });

  it('quotes and doubles an embedded double quote', () => {
    expect(toCsv(['note'], [['She said "hi"']])).toBe('note\r\n"She said ""hi"""');
  });

  it('quotes a field containing a newline', () => {
    expect(toCsv(['note'], [['line1\nline2']])).toBe('note\r\n"line1\nline2"');
  });

  it('leaves a plain numeric field bare', () => {
    expect(toCsv(['amount'], [[5000]])).toBe('amount\r\n5000');
  });

  it('serializes a header-only (empty) row set', () => {
    expect(toCsv(['a', 'b'], [])).toBe('a,b');
  });
});

describe('csvFilename', () => {
  it('appends .csv', () => {
    expect(csvFilename('billing-report')).toBe('billing-report.csv');
  });

  it('strips characters unsafe for a filename/header', () => {
    expect(csvFilename('report 2026/09"; evil')).toBe('report-2026-09---evil.csv');
  });
});
