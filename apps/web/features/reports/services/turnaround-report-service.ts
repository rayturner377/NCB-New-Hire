import type { CaseWithPatient } from '@ncb/database';
import { listCasesWithPatient, type CasePayload } from '../../cases/services/cases-service';
import { type CaseMilestoneKey, isCaseMilestoneKey } from '../case-milestones';

export interface TurnaroundFilters {
  /** Which two lifecycle points to measure between — defaults to doctor-submitted → HR-reviewed, the report's original (HR-only) scope. */
  fromMilestone?: string;
  toMilestone?: string;
  /** Inclusive "YYYY-MM-DD", applied to the `toMilestone`'s own date — when the case reached the endpoint being measured to, not when it was created. */
  from?: string;
  to?: string;
  /** Matched against the joined patient's fullName — case-insensitive, substring, same as the billing reports. */
  query?: string;
}

export interface TurnaroundRow {
  id: string;
  patientFullName: string;
  fromDate: string;
  toDate: string;
  turnaroundDays: number;
}

export interface TurnaroundReportData {
  fromMilestone: CaseMilestoneKey;
  toMilestone: CaseMilestoneKey;
  casesCounted: number;
  averageDays: number;
  minDays: number;
  maxDays: number;
  rows: TurnaroundRow[];
}

export const DEFAULT_FROM_MILESTONE: CaseMilestoneKey = 'doctorSubmittedAt';
export const DEFAULT_TO_MILESTONE: CaseMilestoneKey = 'reviewedAt';

function resolveMilestone(value: string | undefined, fallback: CaseMilestoneKey): CaseMilestoneKey {
  return value && isCaseMilestoneKey(value) ? value : fallback;
}

function daysBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
}

/**
 * How long a case takes between any two of its own lifecycle timestamps — generalized from what
 * used to be a fixed "HR review turnaround" (doctorSubmittedAt → reviewedAt, still the default
 * here) so the same report answers "doctor submit to HR review", "case reaching the doctor to
 * doctor submission", "case creation to payment", or any other pairing case-milestones.ts defines,
 * without needing a bespoke report per question. A case missing either endpoint for the selected
 * pair (hasn't reached one of them yet, or never will given how it was routed) is left out rather
 * than shown with a blank/bogus duration — same for the rare case where the two timestamps are out
 * of the expected order (a data anomaly, not a real negative turnaround).
 */
export async function getCaseTurnaroundReport(filters: TurnaroundFilters = {}): Promise<TurnaroundReportData> {
  const fromMilestone = resolveMilestone(filters.fromMilestone, DEFAULT_FROM_MILESTONE);
  const toMilestone = resolveMilestone(filters.toMilestone, DEFAULT_TO_MILESTONE);
  const cases = await listCasesWithPatient();
  const { from, to, query } = filters;
  const needle = query?.trim().toLowerCase();

  const rows: TurnaroundRow[] = cases
    .map((item) => ({ item, fromDate: milestoneDate(item, fromMilestone), toDate: milestoneDate(item, toMilestone) }))
    .filter((entry): entry is { item: CaseWithPatient<CasePayload>; fromDate: Date; toDate: Date } =>
      Boolean(entry.fromDate && entry.toDate && entry.toDate.getTime() >= entry.fromDate.getTime())
    )
    .filter(({ toDate }) => {
      if (from && toDate < new Date(`${from}T00:00:00.000Z`)) return false;
      if (to && toDate > new Date(`${to}T23:59:59.999Z`)) return false;
      return true;
    })
    .filter(({ item }) => !needle || item.patient.fullName.toLowerCase().includes(needle))
    .map(({ item, fromDate, toDate }) => ({
      id: item.id,
      patientFullName: item.patient.fullName,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      turnaroundDays: daysBetween(fromDate, toDate)
    }))
    .sort((a, b) => new Date(b.toDate).getTime() - new Date(a.toDate).getTime());

  const days = rows.map((row) => row.turnaroundDays);
  return {
    fromMilestone,
    toMilestone,
    casesCounted: rows.length,
    averageDays: days.length ? days.reduce((sum, value) => sum + value, 0) / days.length : 0,
    minDays: days.length ? Math.min(...days) : 0,
    maxDays: days.length ? Math.max(...days) : 0,
    rows
  };
}

function milestoneDate(item: CaseWithPatient<CasePayload>, milestone: CaseMilestoneKey): Date | null {
  return item[milestone] ?? null;
}
