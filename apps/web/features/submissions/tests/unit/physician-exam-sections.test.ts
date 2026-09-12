import { describe, expect, it } from 'vitest';
import { physicianExamFieldLabel } from '../../physician-exam-sections';

describe('physicianExamFieldLabel', () => {
  it('returns the canonical label for a known field key', () => {
    expect(physicianExamFieldLabel('bloodPressure')).toBe('Blood pressure');
  });

  it('humanizes an unknown camelCase key as a fallback', () => {
    expect(physicianExamFieldLabel('vitalsHeartRate')).toBe('Vitals Heart Rate');
  });

  it('capitalizes a single-word unknown key', () => {
    expect(physicianExamFieldLabel('notes')).toBe('Notes');
  });
});
