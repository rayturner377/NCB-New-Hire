/** Ported from server.js CASE_ROUTES/CASE_STATUSES (~L291-306). */
export type CaseRoute = 'patient' | 'doctor';

export type CaseStatus =
  | 'draft'
  | 'sent_to_patient'
  | 'patient_completed'
  | 'sent_to_doctor'
  | 'doctor_submitted'
  | 'canceled_by_doctor'
  | 'review_pending'
  | 'reviewed'
  | 'archived'
  | 'withdrawn';

/**
 * A case the doctor/candidate backed out of, rather than one that ran its course — never payable
 * (see billing-status.ts's derivedPaymentStatus) and excluded from billing reports entirely, not
 * even as a $0 "not payable" row. Was duplicated as an identically-valued CANCELED_STATUSES set in
 * both billing-report-service.ts and reviewer-dashboard-service.ts.
 */
export function isCancelledCase(status: string): boolean {
  return status === 'canceled_by_doctor' || status === 'withdrawn';
}

/**
 * Nothing left for anyone to do on this case — reviewed (HR signed off), archived, canceled, or
 * withdrawn. Distinct from isCancelledCase: a `reviewed` case is closed but was never cancelled.
 * Was duplicated as an identically-valued CLOSED_STATUSES set in cases-service.ts's
 * countCasesForClinician and patient-dashboard.tsx.
 */
export function isCaseClosed(status: string): boolean {
  return status === 'reviewed' || status === 'archived' || status === 'canceled_by_doctor' || status === 'withdrawn';
}
