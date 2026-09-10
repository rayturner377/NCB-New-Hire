export type BillingStatus = 'unpaid' | 'paid' | 'not_payable';

/** Ported from public/app.js's doctorPaymentStatus (~L4917-4919) — a case that's already dead (canceled by the doctor or withdrawn) is never billable regardless of whatever the `payment_status` column happens to hold, and a live case with no payment_status recorded yet defaults to unpaid rather than showing as blank. */
export function derivedPaymentStatus(status: string, paymentStatus: string | null | undefined): BillingStatus {
  if (status === 'canceled_by_doctor' || status === 'withdrawn') return 'not_payable';
  return (paymentStatus as BillingStatus) || 'unpaid';
}

export const BILLING_STATUS_OPTIONS: BillingStatus[] = ['unpaid', 'paid', 'not_payable'];
