import { describe, expect, it } from 'vitest';
import { statusLabel, statusTone } from '../../status-labels';

describe('status-labels', () => {
  it('maps known case statuses to their label and tone', () => {
    expect(statusLabel('doctor_submitted')).toBe('Doctor submitted');
    expect(statusTone('doctor_submitted')).toBe('warning');

    expect(statusLabel('reviewed')).toBe('Reviewed');
    expect(statusTone('reviewed')).toBe('success');

    expect(statusLabel('withdrawn')).toBe('Withdrawn');
    expect(statusTone('withdrawn')).toBe('danger');
  });

  it('maps payment statuses', () => {
    expect(statusLabel('paid')).toBe('Paid');
    expect(statusTone('paid')).toBe('success');
    expect(statusLabel('not_payable')).toBe('Not payable');
  });

  it('falls back to a title-cased version of unknown statuses', () => {
    expect(statusLabel('some_new_status')).toBe('Some New Status');
    expect(statusTone('some_new_status')).toBe('neutral');
  });

  it('handles an empty string without throwing', () => {
    expect(() => statusLabel('')).not.toThrow();
    expect(statusTone('')).toBe('neutral');
  });
});
