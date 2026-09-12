import { describe, expect, it } from 'vitest';
import { caseTypeLabel } from '../../case-types';

describe('caseTypeLabel', () => {
  it('returns "Not set" for a missing case type', () => {
    expect(caseTypeLabel(undefined)).toBe('Not set');
    expect(caseTypeLabel(null)).toBe('Not set');
    expect(caseTypeLabel('')).toBe('Not set');
  });

  it('returns the canonical label for a known case type', () => {
    expect(caseTypeLabel('pre_employment')).toBe('Pre-employment');
  });

  it('falls back to the raw value for an unrecognized case type', () => {
    expect(caseTypeLabel('some_legacy_type')).toBe('some_legacy_type');
  });
});
