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
    // CaseBillingFilter is an exhaustive union of the 4 valid values — reaching here means a
    // caller bypassed that type (e.g. an unvalidated raw string cast through `as`), which is a
    // bug at the call site, not a value this layer should try to interpret. Callers taking input
    // from a URL should validate it upstream (see billing-status.ts's parseBillingFilter) so a
    // typo/garbage query param never reaches this far in the first place.
    throw new Error(`buildCaseBillingWhere: not a valid billing filter: ${JSON.stringify(billing)}`);
  }
  return null;
}
