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
  /** Whether choosing this action requires picking a doctor first (see components/case-action-menu.tsx's dialog). */
  requiresDoctor: boolean;
}

const SEND_TO_DOCTOR: CaseActionDefinition = {
  id: 'send_to_doctor',
  label: 'Send to doctor',
  description: 'Choose the doctor who should receive this case.',
  targetStatus: 'sent_to_doctor',
  requiresDoctor: true
};

const SEND_TO_PATIENT: CaseActionDefinition = {
  id: 'send_to_patient',
  label: 'Send back to patient',
  description: 'Reopens the intake form for the same patient to edit and resubmit.',
  targetStatus: 'sent_to_patient',
  requiresDoctor: false
};

const COMPLETE_REVIEW: CaseActionDefinition = {
  id: 'complete_review',
  label: 'Complete review',
  description: 'Marks HR review as done — this case is fully processed.',
  targetStatus: 'reviewed',
  requiresDoctor: false
};

const CANCEL: CaseActionDefinition = {
  id: 'cancel',
  label: 'Cancel case',
  description: 'Marks this case as withdrawn — it will no longer be processed, and it drops out of the doctor/patient queues.',
  targetStatus: 'withdrawn',
  requiresDoctor: false
};

/**
 * Every action available from `status`, already filtered for `role` —
 * callers don't need to separately re-check "is this role allowed to make
 * this particular move," since a caller only ever sees the actions they're
 * actually allowed to take. A 'clinician' caller is restricted to sending a
 * case back to the patient and nothing else, regardless of status, matching
 * the current product decision to eventually let doctors do that one thing
 * (see lib/permissions.ts's comment on why MEDICAL_CASES_TRANSITION isn't
 * granted to them yet).
 */
export function availableCaseActions(status: CaseStatus | string, role: string): CaseActionDefinition[] {
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

export function findCaseAction(status: CaseStatus | string, role: string, actionId: string): CaseActionDefinition | undefined {
  return availableCaseActions(status, role).find((action) => action.id === actionId);
}
