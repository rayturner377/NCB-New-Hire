import { casesRepository, type CaseWithPatient } from '@ncb/database';
import { loadMasterKey } from '../../../lib/master-key';
import { derivedPaymentStatus, type BillingStatus } from '../../cases/billing-status';
import { hasDoctorSubmitted, type CasePayload } from '../../cases/services/cases-service';
import { isCancelledCase } from '../../cases/types';
import { listUsers } from '../../users/services/users-service';
import { financialYearOptions } from '../financial-year';

export interface BillingReportFilters {
  from?: string;
  to?: string;
  query?: string;
  /** Narrows the row list only — the paid/outstanding stat cards always reflect the full date range regardless of this, so both totals stay visible while drilling into one of them. */
  billing?: string;
}

export interface BillingReportRow {
  id: string;
  status: string;
  billingStatus: BillingStatus;
  payableAmount: number;
  positionAppliedFor: string;
  patientFullName: string;
  createdAt: string;
  doctorSubmittedAt: string | null;
}

export interface BillingReportData {
  paidTotal: number;
  outstandingTotal: number;
  /** Count of cases actually billed (submitted with a rate) within the date range — not the same as "assigned", a case with no rate snapshot yet isn't "processed" for billing purposes. */
  casesProcessed: number;
  rows: BillingReportRow[];
}

type BilledCase = CaseWithPatient<CasePayload>;

/**
 * Cases a doctor has actually processed — anything from the moment they
 * submit an assessment onward (see cases-service.ts's hasDoctorSubmitted;
 * before that there's nothing to bill, matching the same gate the case
 * workspace's Billing tab uses) — within a date range and matching a
 * candidate-name search, before any billing-status split. Deliberately NOT
 * gated on `payableAmount` being set: a case a doctor submitted with no rate
 * captured (their profile has no default fee configured) still needs to
 * show up here as outstanding so HR notices it and can set one, rather than
 * silently vanishing from the report the moment it's most relevant. A
 * canceled/withdrawn case is dropped entirely instead — see
 * isCancelledCase.
 *
 * Shared by both the per-doctor and organization-wide reports, parameterized
 * by which date column the range applies to — the doctor's own report
 * ranges over `createdAt` (matching every other date filter in the app),
 * while the org-wide report ranges over `doctorSubmittedAt` for its
 * financial-year filter (see financial-year.ts): a case created in one FY
 * but not actually submitted until the next should land in the FY it was
 * submitted in, not the FY it was opened in.
 */
function filterBilled(
  cases: BilledCase[],
  filters: Pick<BillingReportFilters, 'from' | 'to' | 'query'>,
  dateField: 'createdAt' | 'doctorSubmittedAt' = 'createdAt'
): BilledCase[] {
  const { from, to, query } = filters;
  const needle = query?.trim().toLowerCase();
  return cases.filter((item) => {
    if (!hasDoctorSubmitted(item.status) || isCancelledCase(item.status)) return false;
    const date = item[dateField];
    if ((from || to) && !date) return false;
    if (from && date! < new Date(`${from}T00:00:00.000Z`)) return false;
    if (to && date! > new Date(`${to}T23:59:59.999Z`)) return false;
    if (needle && !item.patient.fullName.toLowerCase().includes(needle)) return false;
    return true;
  });
}

function sumByBillingStatus(cases: BilledCase[], status: BillingStatus): number {
  return cases
    .filter((item) => derivedPaymentStatus(item.status, item.paymentStatus) === status)
    .reduce((sum, item) => sum + Number(item.payableAmount), 0);
}

/** The paid/outstanding/processed totals both reports show as stat cards — always computed over the full (unfiltered-by-billing-status) case list passed in, so both totals stay visible while drilling into one of them. */
function summarizeBilling(cases: BilledCase[]): { paidTotal: number; outstandingTotal: number; casesProcessed: number } {
  return {
    paidTotal: sumByBillingStatus(cases, 'paid'),
    outstandingTotal: sumByBillingStatus(cases, 'unpaid'),
    casesProcessed: cases.length
  };
}

/** The org-wide report's per-doctor summary table — one row per doctor with at least one case in `cases`, sorted with the most money still owed first. */
function groupBillingByClinician(cases: BilledCase[], doctorsById: Map<string, string>): DoctorBillingSummaryRow[] {
  const byDoctorMap = new Map<string, DoctorBillingSummaryRow>();
  for (const item of cases) {
    const clinicianId = item.assignedClinicianId!;
    const existing = byDoctorMap.get(clinicianId) ?? {
      clinicianId,
      clinicianName: doctorsById.get(clinicianId) ?? 'Unknown doctor',
      paidTotal: 0,
      outstandingTotal: 0,
      casesProcessed: 0
    };
    const status = derivedPaymentStatus(item.status, item.paymentStatus);
    if (status === 'paid') existing.paidTotal += Number(item.payableAmount);
    if (status === 'unpaid') existing.outstandingTotal += Number(item.payableAmount);
    existing.casesProcessed += 1;
    byDoctorMap.set(clinicianId, existing);
  }
  return [...byDoctorMap.values()].sort((a, b) => b.outstandingTotal - a.outstandingTotal);
}

function toRow(item: BilledCase): BillingReportRow {
  return {
    id: item.id,
    status: item.status,
    billingStatus: derivedPaymentStatus(item.status, item.paymentStatus),
    payableAmount: Number(item.payableAmount),
    positionAppliedFor: item.payload?.positionAppliedFor || '',
    patientFullName: item.patient.fullName,
    createdAt: item.createdAt.toISOString(),
    doctorSubmittedAt: item.doctorSubmittedAt ? item.doctorSubmittedAt.toISOString() : null
  };
}

/**
 * A doctor's own earnings — every case they've actually submitted an
 * assessment for (see filterBilled), whether or not a rate was captured at
 * the time. A case still sitting in their inbox (not yet submitted) never
 * appears here.
 */
export async function getDoctorBillingReport(clinicianId: string, filters: BillingReportFilters = {}): Promise<BillingReportData> {
  const masterKey = loadMasterKey();
  const cases = await casesRepository.listForClinician<CasePayload>(clinicianId, masterKey);
  const inRange = filterBilled(cases, filters);

  const rows = inRange
    .filter((item) => !filters.billing || derivedPaymentStatus(item.status, item.paymentStatus) === filters.billing)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map(toRow);

  return { ...summarizeBilling(inRange), rows };
}

export interface OrganizationBillingFilters extends BillingReportFilters {
  clinicianId?: string;
}

export interface DoctorBillingSummaryRow {
  clinicianId: string;
  clinicianName: string;
  paidTotal: number;
  outstandingTotal: number;
  casesProcessed: number;
}

export interface OrganizationBillingData {
  paidTotal: number;
  outstandingTotal: number;
  casesProcessed: number;
  doctors: { id: string; displayName: string }[];
  /** Every FY with at least one billed case, plus the current FY even if empty — see financial-year.ts. */
  availableFinancialYears: string[];
  /** Present when no specific doctor is selected — one row per doctor with any billed case, for the org-wide overview. */
  byDoctor?: DoctorBillingSummaryRow[];
  /** Present when a specific doctor is selected — that doctor's own case-level rows, same shape as getDoctorBillingReport's. */
  rows?: BillingReportRow[];
}

/**
 * The admin/reviewer equivalent of a doctor's own /billing — org-wide by
 * default (a per-doctor summary table), or drills into one doctor's
 * case-level detail once `clinicianId` is chosen. Reuses the same
 * `listAllWithPatient` the cases list already relies on rather than a new
 * repository method, since "every case" is exactly what that already
 * returns. Date-filtered by `doctorSubmittedAt` (see filterBilled's
 * comment) — the caller (organization-billing-report-container.tsx) is what
 * turns a financial-year selection into `from`/`to` bounds; this function
 * only knows about a plain date range.
 */
export async function getOrganizationBillingReport(filters: OrganizationBillingFilters = {}): Promise<OrganizationBillingData> {
  const masterKey = loadMasterKey();
  const [allCases, allUsers] = await Promise.all([casesRepository.listAllWithPatient<CasePayload>(masterKey), listUsers()]);

  const doctorsById = new Map(allUsers.filter((user) => user.role === 'clinician').map((user) => [user.id, user.displayName]));
  const doctors = allUsers.filter((user) => user.role === 'clinician').map((user) => ({ id: user.id, displayName: user.displayName }));

  const billedCases = allCases.filter((item): item is BilledCase => Boolean(item.assignedClinicianId));
  const earliestSubmitted = billedCases
    .map((item) => item.doctorSubmittedAt)
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
  const availableFinancialYears = financialYearOptions(earliestSubmitted);

  const inRange = filterBilled(billedCases, filters, 'doctorSubmittedAt').filter(
    (item) => !filters.clinicianId || item.assignedClinicianId === filters.clinicianId
  );

  const summary = summarizeBilling(inRange);

  // Narrows whichever "row list" the caller ends up seeing — the drill-down's own case rows below,
  // or (when no doctor is picked) the per-doctor summary table further down. summary above
  // deliberately stays unfiltered, same as the drill-down already did.
  const filteredForList = inRange.filter(
    (item) => !filters.billing || derivedPaymentStatus(item.status, item.paymentStatus) === filters.billing
  );

  if (filters.clinicianId) {
    const rows = filteredForList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(toRow);
    return { ...summary, doctors, availableFinancialYears, rows };
  }

  const byDoctor = groupBillingByClinician(filteredForList, doctorsById);

  return { ...summary, doctors, availableFinancialYears, byDoctor };
}
