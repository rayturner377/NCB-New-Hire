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
