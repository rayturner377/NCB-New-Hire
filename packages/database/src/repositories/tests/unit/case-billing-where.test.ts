import { isCancelledCase } from '@ncb/shared';
import { describe, expect, it } from 'vitest';
import { buildCaseBillingWhere } from '../../case-billing-where.js';

describe('buildCaseBillingWhere()', () => {
  it('returns null for no filter', () => {
    expect(buildCaseBillingWhere(undefined)).toBeNull();
    expect(buildCaseBillingWhere('')).toBeNull();
  });

  it('"not_payable" classifies every cancelled status the same way isCancelledCase does', () => {
    const where = buildCaseBillingWhere('not_payable');
    const [cancelledClause] = where!.OR as Array<{ status?: { in: string[] } }>;
    for (const status of ['canceled_by_doctor', 'withdrawn', 'draft', 'reviewed']) {
      const matchesViaWhere = cancelledClause.status!.in.includes(status);
      expect(matchesViaWhere).toBe(isCancelledCase(status));
    }
  });

  it('"paid" excludes every status isCancelledCase would flag', () => {
    const where = buildCaseBillingWhere('paid');
    const notIn = (where as { status: { notIn: string[] } }).status.notIn;
    for (const status of ['canceled_by_doctor', 'withdrawn']) {
      expect(notIn.includes(status)).toBe(isCancelledCase(status));
    }
  });

  it('"unpaid" excludes every status isCancelledCase would flag', () => {
    const where = buildCaseBillingWhere('unpaid');
    const notIn = (where as { status: { notIn: string[] } }).status.notIn;
    for (const status of ['canceled_by_doctor', 'withdrawn']) {
      expect(notIn.includes(status)).toBe(isCancelledCase(status));
    }
  });

  it('an unrecognized value matches no case', () => {
    // @ts-expect-error deliberately invalid, to confirm the fallback for a garbage query param
    expect(buildCaseBillingWhere('garbage')).toEqual({ id: '__no_case_matches_this_billing_value__' });
  });
});
