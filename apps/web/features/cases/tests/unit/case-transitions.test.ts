import { describe, expect, it } from 'vitest';
import { availableCaseActions, findCaseAction } from '../../case-transitions';

describe('availableCaseActions', () => {
  it('sent_to_patient offers a manual skip-ahead to the doctor stage, requiring a doctor, and cancel', () => {
    const actions = availableCaseActions('sent_to_patient', 'reviewer');
    expect(actions.map((a) => a.id)).toEqual(['send_to_doctor', 'cancel']);
    expect(actions[0]?.requiresDoctor).toBe(true);
  });

  it('sent_to_doctor offers sending back to the patient (no doctor picker needed) and cancel', () => {
    const actions = availableCaseActions('sent_to_doctor', 'reviewer');
    expect(actions.map((a) => a.id)).toEqual(['send_to_patient', 'cancel']);
    expect(actions[0]?.requiresDoctor).toBe(false);
  });

  it('doctor_submitted offers completing review, sending back to the doctor or patient, or cancel', () => {
    const actions = availableCaseActions('doctor_submitted', 'reviewer');
    expect(actions.map((a) => a.id).sort()).toEqual(['cancel', 'complete_review', 'send_to_doctor', 'send_to_patient']);
  });

  it('reviewed can still be reopened back to either earlier stage, or canceled', () => {
    const actions = availableCaseActions('reviewed', 'admin');
    expect(actions.map((a) => a.id).sort()).toEqual(['cancel', 'send_to_doctor', 'send_to_patient']);
  });

  it('statuses with no defined moves (draft, patient_completed, withdrawn, ...) offer nothing', () => {
    expect(availableCaseActions('draft', 'admin')).toEqual([]);
    expect(availableCaseActions('withdrawn', 'admin')).toEqual([]);
    expect(availableCaseActions('archived', 'admin')).toEqual([]);
  });

  it('a clinician caller is restricted to "send back to patient" only, regardless of status', () => {
    expect(availableCaseActions('doctor_submitted', 'clinician').map((a) => a.id)).toEqual(['send_to_patient']);
    expect(availableCaseActions('reviewed', 'clinician').map((a) => a.id)).toEqual(['send_to_patient']);
    // sent_to_patient never offers send_to_patient to begin with, so a clinician gets nothing there.
    expect(availableCaseActions('sent_to_patient', 'clinician')).toEqual([]);
  });

  it('an unrecognized status offers nothing rather than throwing', () => {
    expect(availableCaseActions('not-a-real-status', 'admin')).toEqual([]);
  });

  it('a reviewed AND paid case is locked to reason-required reopen moves only, no cancel, for admin/reviewer', () => {
    for (const role of ['admin', 'reviewer']) {
      const actions = availableCaseActions('reviewed', role, true);
      expect(actions.map((a) => a.id).sort()).toEqual(['send_to_doctor', 'send_to_patient']);
      expect(actions.every((a) => a.requiresReason)).toBe(true);
    }
  });

  it('a reviewed AND paid case offers nothing to a role other than admin/reviewer', () => {
    expect(availableCaseActions('reviewed', 'auditor', true)).toEqual([]);
    expect(availableCaseActions('reviewed', 'clinician', true)).toEqual([]);
  });

  it('a reviewed but NOT YET paid case keeps the ordinary, reason-free reopen moves plus cancel', () => {
    const actions = availableCaseActions('reviewed', 'admin', false);
    expect(actions.map((a) => a.id).sort()).toEqual(['cancel', 'send_to_doctor', 'send_to_patient']);
    expect(actions.every((a) => !a.requiresReason)).toBe(true);
  });

  it('isPaid only locks down the reviewed status — a paid flag elsewhere has no effect (defensive, shouldn\'t happen in practice)', () => {
    expect(availableCaseActions('doctor_submitted', 'admin', true).map((a) => a.id).sort()).toEqual([
      'cancel',
      'complete_review',
      'send_to_doctor',
      'send_to_patient'
    ]);
  });
});

describe('findCaseAction', () => {
  it('finds an action by id among what is currently available', () => {
    const action = findCaseAction('sent_to_doctor', 'admin', 'send_to_patient');
    expect(action?.targetStatus).toBe('sent_to_patient');
  });

  it('returns undefined for an action id that is not available from this status', () => {
    expect(findCaseAction('sent_to_patient', 'admin', 'complete_review')).toBeUndefined();
  });

  it('returns undefined for an action a clinician is not allowed to take, even if an admin could', () => {
    expect(findCaseAction('doctor_submitted', 'clinician', 'complete_review')).toBeUndefined();
    expect(findCaseAction('doctor_submitted', 'admin', 'complete_review')).toBeDefined();
  });

  it('finds the reason-required reopen variant once a reviewed case is paid', () => {
    const action = findCaseAction('reviewed', 'admin', 'send_to_doctor', true);
    expect(action?.requiresReason).toBe(true);
  });

  it('a stale request for the ordinary (non-reopen) action id is rejected once the case is paid', () => {
    // Confirms the server re-derives available actions from the CURRENT paid state rather than
    // trusting whatever the client's now-stale page rendered — the same defense apply-case-action.ts
    // already relies on for a stale status.
    expect(findCaseAction('reviewed', 'admin', 'cancel', true)).toBeUndefined();
  });
});
