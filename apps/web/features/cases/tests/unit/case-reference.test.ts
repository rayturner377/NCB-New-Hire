import { describe, expect, it } from 'vitest';
import { parseCaseReference } from '../../case-reference';

function formDataWith(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe('parseCaseReference()', () => {
  it('parses a well-formed caseId/caseVersion pair', () => {
    expect(parseCaseReference(formDataWith({ caseId: 'case_1', caseVersion: '3' }))).toEqual({
      caseId: 'case_1',
      expectedVersion: 3
    });
  });

  it('returns null when caseId is missing', () => {
    expect(parseCaseReference(formDataWith({ caseVersion: '3' }))).toBeNull();
  });

  it('returns null when caseVersion is missing', () => {
    expect(parseCaseReference(formDataWith({ caseId: 'case_1' }))).toBeNull();
  });

  it('returns null when caseVersion is not a finite number', () => {
    expect(parseCaseReference(formDataWith({ caseId: 'case_1', caseVersion: 'not-a-number' }))).toBeNull();
  });
});
