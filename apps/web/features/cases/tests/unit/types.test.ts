import { describe, expect, it } from 'vitest';
import { isCancelledCase, isCaseClosed } from '../../types';

describe('isCancelledCase', () => {
  it('is true for canceled_by_doctor and withdrawn', () => {
    expect(isCancelledCase('canceled_by_doctor')).toBe(true);
    expect(isCancelledCase('withdrawn')).toBe(true);
  });

  it('is false for a reviewed or archived case — cancelled and closed are not the same thing', () => {
    expect(isCancelledCase('reviewed')).toBe(false);
    expect(isCancelledCase('archived')).toBe(false);
  });

  it('is false for every in-progress status', () => {
    expect(isCancelledCase('draft')).toBe(false);
    expect(isCancelledCase('sent_to_doctor')).toBe(false);
  });
});

describe('isCaseClosed', () => {
  it('is true for reviewed, archived, canceled_by_doctor, and withdrawn', () => {
    expect(isCaseClosed('reviewed')).toBe(true);
    expect(isCaseClosed('archived')).toBe(true);
    expect(isCaseClosed('canceled_by_doctor')).toBe(true);
    expect(isCaseClosed('withdrawn')).toBe(true);
  });

  it('is false for every in-progress status', () => {
    expect(isCaseClosed('draft')).toBe(false);
    expect(isCaseClosed('sent_to_patient')).toBe(false);
    expect(isCaseClosed('sent_to_doctor')).toBe(false);
    expect(isCaseClosed('doctor_submitted')).toBe(false);
  });
});
