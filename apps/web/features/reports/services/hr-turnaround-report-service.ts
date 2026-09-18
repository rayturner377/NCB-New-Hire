import { listCasesWithPatient } from '../../cases/services/cases-service';

export interface HrTurnaroundFilters {
  /** Inclusive "YYYY-MM-DD", applied to reviewedAt — when HR actually finished with the case, not when it was created or submitted. */
  from?: string;
  to?: string;
  /** Matched against the joined patient's fullName — case-insensitive, substring, same as the billing reports. */
  query?: string;
}

export interface HrTurnaroundRow {
  id: string;
  patientFullName: string;
  doctorSubmittedAt: string;
  reviewedAt: string;
  turnaroundDays: number;
}

export interface HrTurnaroundReportData {
  casesReviewed: number;
  averageDays: number;
  minDays: number;
  maxDays: number;
  rows: HrTurnaroundRow[];
}

function daysBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
}

/**
 * How long HR itself took to review a case, not the case's whole lifecycle — from the moment it
 * actually landed in the review queue (doctorSubmittedAt) to the moment HR signed off
 * (reviewedAt). Distinct from reviewer-dashboard-service.ts's averageTurnaroundDays, which measures
 * createdAt→reviewedAt (the full case lifecycle, including patient/doctor time) for the dashboard's
 * period summary. A case still awaiting review (no reviewedAt yet) or reviewed but missing a
 * doctorSubmittedAt (shouldn't happen given the workflow, but defensive per report.md's own
 * "missing data should display N/A rather than break the report" rule) is left out rather than
 * counted with a bogus duration.
 *
 * Reuses listCasesWithPatient() (decrypts every case) rather than a dedicated SQL query — same
 * accepted tradeoff QUERY_OPTIMIZATION.md already documents for the reviewer dashboard's own
 * aggregate reads, not a new one introduced here.
 */
export async function getHrReviewTurnaroundReport(filters: HrTurnaroundFilters = {}): Promise<HrTurnaroundReportData> {
  const cases = await listCasesWithPatient();
  const { from, to, query } = filters;
  const needle = query?.trim().toLowerCase();

  const rows: HrTurnaroundRow[] = cases
    .filter((item) => (item.status === 'reviewed' || item.status === 'archived') && item.doctorSubmittedAt && item.reviewedAt)
    .filter((item) => {
      if (from && item.reviewedAt! < new Date(`${from}T00:00:00.000Z`)) return false;
      if (to && item.reviewedAt! > new Date(`${to}T23:59:59.999Z`)) return false;
      if (needle && !item.patient.fullName.toLowerCase().includes(needle)) return false;
      return true;
    })
    .map((item) => ({
      id: item.id,
      patientFullName: item.patient.fullName,
      doctorSubmittedAt: item.doctorSubmittedAt!.toISOString(),
      reviewedAt: item.reviewedAt!.toISOString(),
      turnaroundDays: daysBetween(item.doctorSubmittedAt!, item.reviewedAt!)
    }))
    .sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime());

  const days = rows.map((row) => row.turnaroundDays);
  return {
    casesReviewed: rows.length,
    averageDays: days.length ? days.reduce((sum, value) => sum + value, 0) / days.length : 0,
    minDays: days.length ? Math.min(...days) : 0,
    maxDays: days.length ? Math.max(...days) : 0,
    rows
  };
}
