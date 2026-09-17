export const BILLING_STATUS_OPTIONS = ['unpaid', 'paid', 'not_payable'] as const;

export type BillingStatus = (typeof BILLING_STATUS_OPTIONS)[number];

export function isBillingStatus(value: string): value is BillingStatus {
  return (BILLING_STATUS_OPTIONS as readonly string[]).includes(value);
}

/** Ported from public/app.js's doctorPaymentStatus (~L4917-4919) — a case that's already dead (canceled by the doctor or withdrawn) is never billable regardless of whatever the `payment_status` column happens to hold, and a live case with no payment_status recorded yet (or one holding something other than a real BillingStatus) defaults to unpaid rather than showing as blank. */
export function derivedPaymentStatus(status: string, paymentStatus: string | null | undefined): BillingStatus {
  if (status === 'canceled_by_doctor' || status === 'withdrawn') return 'not_payable';
  return paymentStatus && isBillingStatus(paymentStatus) ? paymentStatus : 'unpaid';
}
