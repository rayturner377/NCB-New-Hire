import { describe, expect, it } from 'vitest';
import { containingFinancialYear, financialYearBounds, financialYearLabelForDate, financialYearOptions } from '../../financial-year';

describe('financialYearLabelForDate', () => {
  it('October through December fall in the FY named for the following calendar year', () => {
    expect(financialYearLabelForDate(new Date('2025-10-01T00:00:00.000Z'))).toBe('FY26');
    expect(financialYearLabelForDate(new Date('2025-12-31T23:59:59.000Z'))).toBe('FY26');
  });

  it('January through September fall in the FY named for that same calendar year', () => {
    expect(financialYearLabelForDate(new Date('2026-01-01T00:00:00.000Z'))).toBe('FY26');
    expect(financialYearLabelForDate(new Date('2026-09-30T23:59:59.000Z'))).toBe('FY26');
  });
});

describe('financialYearBounds', () => {
  it('FY26 runs October 1 2025 through September 30 2026', () => {
    expect(financialYearBounds('FY26')).toEqual({ from: '2025-10-01', to: '2026-09-30' });
  });

  it('returns null for a malformed label', () => {
    expect(financialYearBounds('not-a-fy')).toBeNull();
    expect(financialYearBounds('2026')).toBeNull();
  });
});

describe('containingFinancialYear', () => {
  it('an exact FY26 range is contained in FY26', () => {
    expect(containingFinancialYear('2025-10-01', '2026-09-30')).toBe('FY26');
  });

  it('a narrower sub-range within FY26 is still contained in FY26', () => {
    expect(containingFinancialYear('2026-01-20', '2026-03-10')).toBe('FY26');
  });

  it('a range spanning an FY boundary is contained in neither', () => {
    expect(containingFinancialYear('2025-08-01', '2025-11-01')).toBeNull();
  });

  it('an open-ended range (only one bound) is not "contained"', () => {
    expect(containingFinancialYear('2026-01-01', '')).toBeNull();
    expect(containingFinancialYear('', '2026-01-01')).toBeNull();
  });
});

describe('financialYearOptions', () => {
  it('always includes at least the current FY, even with no data', () => {
    const options = financialYearOptions(null);
    expect(options.length).toBeGreaterThanOrEqual(1);
  });

  it('spans from the earliest billed date through the current FY, most recent first', () => {
    const options = financialYearOptions(new Date('2022-11-01T00:00:00.000Z'));
    expect(options[0]).not.toBe(options.at(-1));
    expect(options).toEqual([...options].sort().reverse());
    expect(options.at(-1)).toBe('FY23');
  });
});
