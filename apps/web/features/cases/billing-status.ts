import { isCancelledCase } from './types';

export const BILLING_STATUS_OPTIONS = ['unpaid', 'paid', 'not_payable'] as const;

export type BillingStatus = (typeof BILLING_STATUS_OPTIONS)[number];

export function isBillingStatus(value: string): value is BillingStatus {
  return (BILLING_STATUS_OPTIONS as readonly string[]).includes(value);
}

/** Normalizes a raw `?billing=` URL value to a real BillingStatus or '' (no filter) — a garbage or stale value (a typo, an old bookmarked link) is treated as no filter rather than passed through to a query that's guaranteed to match nothing. */
export function parseBillingFilter(value: string | undefined): BillingStatus | '' {
  return value && isBillingStatus(value) ? value : '';
}

/** The authoritative billing interpretation of a case: a cancelled case (see isCancelledCase) is never billable regardless of whatever the `payment_status` column happens to hold, and a live case with no payment_status recorded yet (or one holding something other than a real BillingStatus) defaults to unpaid rather than showing as blank. */
export function derivedPaymentStatus(status: string, paymentStatus: string | null | undefined): BillingStatus {
  if (isCancelledCase(status)) return 'not_payable';
  return paymentStatus && isBillingStatus(paymentStatus) ? paymentStatus : 'unpaid';
}
