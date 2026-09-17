import { CANCELLED_CASE_STATUSES } from '@ncb/shared';
import type { Prisma } from '../generated/client/index.js';

export type CaseBillingFilter = 'paid' | 'unpaid' | 'not_payable' | '';

/**
 * The one place billing-status filtering is translated into a MedicalCase `where` fragment,
 * reused by both cases.ts's buildCaseSearchWhere (filtering cases directly) and candidates.ts's
 * buildCandidateSearchWhere (wrapped in `cases: { some: ... }`, filtering candidates by their
 * cases' billing status) — matches billing-status.ts's derivedPaymentStatus exactly, so a case
 * that shows as e.g. "not_payable" in the UI is exactly the set this returns for 'not_payable'.
 * Returns null for no filter.
 */
export function buildCaseBillingWhere(billing: CaseBillingFilter | undefined): Prisma.MedicalCaseWhereInput | null {
  const cancelled: string[] = [...CANCELLED_CASE_STATUSES];
  if (billing === 'not_payable') {
    return { OR: [{ status: { in: cancelled } }, { paymentStatus: 'not_payable' }] };
  }
  if (billing === 'paid') {
    return { status: { notIn: cancelled }, paymentStatus: 'paid' };
  }
  if (billing === 'unpaid') {
    return {
      status: { notIn: cancelled },
      OR: [{ paymentStatus: null }, { paymentStatus: { notIn: ['paid', 'not_payable'] } }]
    };
  }
  if (billing) {
    // An unrecognized non-empty value — match nothing rather than silently ignoring the filter.
    return { id: '__no_case_matches_this_billing_value__' };
  }
  return null;
}
