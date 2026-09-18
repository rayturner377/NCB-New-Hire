import type { CaseStatus } from './types';

/**
 * The guided "Case actions" menu's whole rule set — every legal move a case
 * can make from a given status, for a given role, replacing the old
 * "Update status" control that let any status change into any other
 * (draft straight to reviewed, reviewed back to draft, etc.) with no
 * concept of a real workflow. `draft`/`patient_completed`/`review_pending`
 * don't appear anywhere below: nothing in this app currently puts a case
 * into any of those three, so there's no "current status" case for them to
 * handle yet.
 */
export type CaseActionId = 'send_to_doctor' | 'send_to_patient' | 'complete_review' | 'cancel';

export interface CaseActionDefinition {
  id: CaseActionId;
  label: string;
  description: string;
  targetStatus: CaseStatus;
  /** Whether choosing this action requires picking a doctor first (see components/case-actions-menu.tsx's dialog). */
  requiresDoctor: boolean;
  /** Whether choosing this action requires typing a reason first, logged with the transition's audit event — reserved for reopening an already-paid case (see REOPEN_TO_DOCTOR/REOPEN_TO_PATIENT below), not the ordinary pre-payment moves. */
  requiresReason: boolean;
}

const SEND_TO_DOCTOR: CaseActionDefinition = {
  id: 'send_to_doctor',
  label: 'Send to doctor',
  description: 'Choose the doctor who should receive this case.',
  targetStatus: 'sent_to_doctor',
  requiresDoctor: true,
  requiresReason: false
};

const SEND_TO_PATIENT: CaseActionDefinition = {
  id: 'send_to_patient',
  label: 'Send back to patient',
  description: 'Reopens the intake form for the same patient to edit and resubmit.',
  targetStatus: 'sent_to_patient',
  requiresDoctor: false,
  requiresReason: false
};

const COMPLETE_REVIEW: CaseActionDefinition = {
  id: 'complete_review',
  label: 'Complete review',
  description: 'Marks HR review as done — this case is fully processed.',
  targetStatus: 'reviewed',
  requiresDoctor: false,
  requiresReason: false
};

const CANCEL: CaseActionDefinition = {
  id: 'cancel',
  label: 'Cancel case',
  description: 'Marks this case as withdrawn — it will no longer be processed, and it drops out of the doctor/patient queues.',
  targetStatus: 'withdrawn',
  requiresDoctor: false,
  requiresReason: false
};

/**
 * A paid case reopened back to the doctor — same destination as SEND_TO_DOCTOR, but requires a
 * reason (kept with the audit event) since it reverses a completed, paid case rather than moving
 * one still in progress. transition_medical_case (see 0028_reset_payment_on_case_reopen) resets
 * payment_status/payment_confirmed_at on this same move, so the case doesn't keep showing as paid
 * while its assessment is being redone.
 */
const REOPEN_TO_DOCTOR: CaseActionDefinition = {
  id: 'send_to_doctor',
  label: 'Reopen: send to doctor',
  description: 'This case has already been paid. Reopening it clears the payment record — it will need to be confirmed again once resolved. Explain why you’re reopening it.',
  targetStatus: 'sent_to_doctor',
  requiresDoctor: true,
  requiresReason: true
};

const REOPEN_TO_PATIENT: CaseActionDefinition = {
  id: 'send_to_patient',
  label: 'Reopen: send back to patient',
  description: 'This case has already been paid. Reopening it clears the payment record — it will need to be confirmed again once resolved. Explain why you’re reopening it.',
  targetStatus: 'sent_to_patient',
  requiresDoctor: false,
  requiresReason: true
};

/**
 * Every action available from `status`, already filtered for `role` and `isPaid` — callers don't
 * need to separately re-check "is this role allowed to make this particular move" or "is this case
 * locked by payment," since a caller only ever sees the actions they're actually allowed to take.
 *
 * A reviewed AND paid case is locked down to exactly two moves (reopen to doctor, reopen to
 * patient), both requiring a reason, both restricted to admin/reviewer — no plain bounce-back, and
 * no cancelling a case money has already moved for. An unpaid case (including one that's merely
 * `reviewed`) keeps the ordinary, reason-free moves.
 */
export function availableCaseActions(status: CaseStatus | string, role: string, isPaid = false): CaseActionDefinition[] {
  if (status === 'reviewed' && isPaid) {
    return role === 'admin' || role === 'reviewer' ? [REOPEN_TO_DOCTOR, REOPEN_TO_PATIENT] : [];
  }

  const all: CaseActionDefinition[] = (() => {
    switch (status) {
      case 'sent_to_patient':
        // A manual skip-ahead for when the patient can't or won't complete their own
        // intake — HR/admin can push it on to a doctor on the patient's behalf.
        return [SEND_TO_DOCTOR, CANCEL];
      case 'sent_to_doctor':
        return [SEND_TO_PATIENT, CANCEL];
      case 'doctor_submitted':
        return [COMPLETE_REVIEW, SEND_TO_DOCTOR, SEND_TO_PATIENT, CANCEL];
      case 'reviewed':
        // HR finds a problem after the fact — reopen at whichever earlier stage actually needs fixing.
        return [SEND_TO_DOCTOR, SEND_TO_PATIENT, CANCEL];
      default:
        return [];
    }
  })();

  if (role === 'clinician') {
    return all.filter((action) => action.id === 'send_to_patient');
  }
  return all;
}

export function findCaseAction(status: CaseStatus | string, role: string, actionId: string, isPaid = false): CaseActionDefinition | undefined {
  return availableCaseActions(status, role, isPaid).find((action) => action.id === actionId);
}
