/**
 * The single source of truth for "which case statuses mean the case was called off rather than run
 * its course" — never billable regardless of whatever `payment_status` happens to hold, and
 * excluded from billing reports entirely, not even as a $0 "not payable" row.
 *
 * Lives here (not in apps/web, where the business logic otherwise belongs) specifically so
 * packages/database's repositories can depend on it too — apps/web depends on packages/database,
 * never the reverse, so a copy previously had to be hand-maintained in both
 * packages/database/src/repositories/cases.ts and candidates.ts, each with a comment asking the
 * next person to keep it in sync with apps/web/features/cases/types.ts's own isCancelledCase.
 * There is now exactly one definition; every other copy re-exports or calls this one.
 */
export const CANCELLED_CASE_STATUSES = ['canceled_by_doctor', 'withdrawn'] as const;

export function isCancelledCase(status: string): boolean {
  return (CANCELLED_CASE_STATUSES as readonly string[]).includes(status);
}
