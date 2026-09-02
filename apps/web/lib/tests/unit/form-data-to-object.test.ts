import { describe, expect, it } from 'vitest';
import { parseNestedFormData } from '../../form-data-to-object';

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('parseNestedFormData', () => {
  it('builds a nested object from dot-notation keys', () => {
    const result = parseNestedFormData(
      formData({ 'candidate.fullName': 'Jane Doe', 'assessment.facilityName': 'City Medical' })
    );

    expect(result).toEqual({
      candidate: { fullName: 'Jane Doe' },
      assessment: { facilityName: 'City Medical' }
    });
  });

  it('handles top-level (non-nested) keys', () => {
    const result = parseNestedFormData(formData({ route: 'doctor' }));
    expect(result).toEqual({ route: 'doctor' });
  });

  it('returns an empty object for empty FormData', () => {
    expect(parseNestedFormData(new FormData())).toEqual({});
  });
});
