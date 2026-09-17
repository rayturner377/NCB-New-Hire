import { describe, expect, it } from 'vitest';
import { derivedPaymentStatus, parseBillingFilter } from '../../billing-status';

describe('derivedPaymentStatus', () => {
  it('is not_payable for a canceled-by-doctor case regardless of the stored payment status', () => {
    expect(derivedPaymentStatus('canceled_by_doctor', 'paid')).toBe('not_payable');
  });

  it('is not_payable for a withdrawn case regardless of the stored payment status', () => {
    expect(derivedPaymentStatus('withdrawn', 'unpaid')).toBe('not_payable');
  });

  it('passes through a real stored payment status for a live case', () => {
    expect(derivedPaymentStatus('reviewed', 'paid')).toBe('paid');
  });

  it('defaults to unpaid for a live case with no payment status recorded yet', () => {
    expect(derivedPaymentStatus('doctor_submitted', null)).toBe('unpaid');
    expect(derivedPaymentStatus('doctor_submitted', undefined)).toBe('unpaid');
  });
});

describe('parseBillingFilter', () => {
  it('passes through each real BillingStatus value', () => {
    expect(parseBillingFilter('paid')).toBe('paid');
    expect(parseBillingFilter('unpaid')).toBe('unpaid');
    expect(parseBillingFilter('not_payable')).toBe('not_payable');
  });

  it('treats a garbage or stale URL value as no filter rather than one guaranteed to match nothing', () => {
    expect(parseBillingFilter('garbage')).toBe('');
  });

  it('treats a missing value as no filter', () => {
    expect(parseBillingFilter(undefined)).toBe('');
    expect(parseBillingFilter('')).toBe('');
  });
});
