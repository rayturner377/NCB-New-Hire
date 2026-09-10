import { casesRepository, type CaseWithPatient } from '@ncb/database';
import { loadMasterKey } from '../../../../lib/master-key';
import type { CasePayload } from '../../../cases/services/cases-service';

export type DoctorCaseRow = CaseWithPatient<CasePayload>;

export interface DoctorCaseHistoryFilters {
  status?: string;
  from?: string;
  to?: string;
}

export interface DoctorDashboardData {
  newCases: number;
  submittedForHrReview: number;
  processedThisMonth: number;
  inbox: DoctorCaseRow[];
  /** Every case the doctor has already acted on (anything past `sent_to_doctor`), filtered — see DoctorCaseHistoryFilters. Not paginated here; the container slices a page off this. */
  history: DoctorCaseRow[];
}

function isSameMonth(date: Date, reference: Date): boolean {
  return date.getUTCFullYear() === reference.getUTCFullYear() && date.getUTCMonth() === reference.getUTCMonth();
}

/** Ported from server.js doctorDashboardStats (public/app.js ~L1756-1765), scoped to this clinician's assigned cases — now with a filterable history section alongside the live inbox. */
export async function getDoctorDashboardData(clinicianId: string, filters: DoctorCaseHistoryFilters = {}): Promise<DoctorDashboardData> {
  const masterKey = loadMasterKey();
  const cases = await casesRepository.listForClinician<CasePayload>(clinicianId, masterKey);

  // A reviewer can pull a case out of the doctor's inbox without canceling it
  // (see cases-service.ts's setCaseHidden) — it stays fully visible/actionable
  // everywhere else (case history, the reviewer's own case list), just not
  // here.
  const inbox = cases.filter((item) => item.status === 'sent_to_doctor' && !item.payload?.hidden);
  const submittedForHrReview = cases.filter((item) => ['doctor_submitted', 'review_pending'].includes(item.status)).length;

  const now = new Date();
  const processedThisMonth = cases.filter((item) => item.doctorSubmittedAt && isSameMonth(item.doctorSubmittedAt, now)).length;

  const { status, from, to } = filters;
  const history = cases
    .filter((item) => item.status !== 'sent_to_doctor')
    .filter((item) => {
      const matchesStatus = !status || item.status === status;
      const matchesFrom = !from || item.createdAt >= new Date(`${from}T00:00:00.000Z`);
      const matchesTo = !to || item.createdAt <= new Date(`${to}T23:59:59.999Z`);
      return matchesStatus && matchesFrom && matchesTo;
    })
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return {
    newCases: inbox.length,
    submittedForHrReview,
    processedThisMonth,
    inbox,
    history
  };
}
