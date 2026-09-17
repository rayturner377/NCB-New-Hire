import { isCancelledCase as sharedIsCancelledCase } from '@ncb/shared';

/** Statuses reached before a doctor has actually submitted an assessment — a case's billed amount/payment status don't exist yet at any of these (create-submission.ts snapshots the billed amount only at submission time), so billing/payment controls should stay disabled until past this set. */
const PRE_DOCTOR_STATUSES = new Set(['draft', 'sent_to_patient', 'patient_completed', 'sent_to_doctor']);

/**
 * Whether a case has progressed far enough for billing/payment to make sense — see
 * PRE_DOCTOR_STATUSES above. Pure (just a status check), so it lives in its own dependency-light
 * module rather than cases-service.ts — case-workspace-capabilities.ts derives its whole
 * capability set from just this and a couple of permission checks, and shouldn't have to pull in
 * cases-service.ts's database/settings/encryption/notification imports to get it.
 */
export function hasDoctorSubmitted(status: string): boolean {
  return !PRE_DOCTOR_STATUSES.has(status);
}

/**
 * A case the doctor/candidate backed out of, rather than one that ran its course — never payable
 * (see billing-status.ts's derivedPaymentStatus) and excluded from billing reports entirely, not
 * even as a $0 "not payable" row. Re-exports @ncb/shared's canonical definition (rather than
 * re-declaring the status list here) so packages/database's repositories, which can't depend on
 * apps/web, classify cases the exact same way as the application layer does.
 */
export function isCancelledCase(status: string): boolean {
  return sharedIsCancelledCase(status);
}

/**
 * Nothing left for anyone to do on this case — reviewed (HR signed off), archived, canceled, or
 * withdrawn. Distinct from isCancelledCase: a `reviewed` case is closed but was never cancelled.
 */
export function isCaseClosed(status: string): boolean {
  return status === 'reviewed' || status === 'archived' || isCancelledCase(status);
}
