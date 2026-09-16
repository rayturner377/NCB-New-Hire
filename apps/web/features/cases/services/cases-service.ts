import { randomUUID } from 'node:crypto';
import { auditRepository, casesRepository, usersRepository } from '@ncb/database';
import { loadMasterKey } from '../../../lib/master-key';
import { getCandidateById } from '../../candidates/services/candidates-service';
import { sendNotification } from '../../notifications/services/notification-service';
import { getSettings } from '../../settings/services/settings-service';
import type { PatientCaseData } from '../patient-case-data';
import type { CreateCaseSchemaInput } from '../schemas/case';
import type { CaseStatus } from '../types';

export interface CreateCaseInput extends CreateCaseSchemaInput {
  createdBy: string;
}

/**
 * MedicalCase.payload's shape — `caseType`/`positionAppliedFor` are set at
 * creation time (see schemas/case.ts); `patientCaseData` is added once a case
 * reaches `sent_to_patient`; `doctorAssessmentDraft` is the doctor's own
 * in-progress assessment, saved by the same autosave pattern as the
 * patient's form but never validated (a raw, loosely-shaped snapshot of the
 * assessment form's fields — see save-submission-draft.ts) and cleared once
 * the doctor actually submits (see createSubmissionAction), so a case sent
 * back to the doctor stage later never resurfaces stale draft data. All
 * fields must survive each other's writes — see savePatientCaseProgress/
 * submitPatientCase/saveDoctorAssessmentDraft below.
 */
export interface CasePayload {
  patientCaseData?: PatientCaseData;
  positionAppliedFor?: string;
  caseType?: string;
  doctorAssessmentDraft?: Record<string, unknown>;
  /** Set by a reviewer/admin to pull a case out of the doctor/patient queues without canceling it (see setCaseHidden below) — a visibility flag, not a stage transition, so it lives alongside the rest of the payload rather than as its own column. */
  hidden?: boolean;
}

/**
 * Ported from server.js sanitizeMedicalCase (~L2535-2560), with route derived
 * from clinician selection rather than a separate manual dropdown (see
 * schemas/case.ts's comment for why).
 */
export async function createCase(input: CreateCaseInput) {
  const masterKey = loadMasterKey();
  const id = randomUUID();
  const route = input.assignedClinicianId ? 'doctor' : 'patient';
  const status: CaseStatus = route === 'patient' ? 'sent_to_patient' : 'sent_to_doctor';

  const created = await casesRepository.create(
    {
      id,
      patientId: input.patientId,
      createdBy: input.createdBy,
      assignedClinicianId: input.assignedClinicianId || undefined,
      route,
      status,
      payload: { positionAppliedFor: input.positionAppliedFor, caseType: input.caseType } satisfies CasePayload
    },
    masterKey
  );

  await auditRepository.append({
    eventType: 'case_created',
    actorUserId: input.createdBy,
    entityType: 'case',
    entityId: id,
    details: { route, status }
  });

  return created;
}

export async function listCases() {
  const masterKey = loadMasterKey();
  return casesRepository.listAll(masterKey);
}

/** All cases with the patient's non-encrypted name/employeeId joined in, for the cases list page and the candidates page's per-candidate case history. */
export async function listCasesWithPatient() {
  const masterKey = loadMasterKey();
  return casesRepository.listAllWithPatient<CasePayload>(masterKey);
}

export async function getCaseById(id: string) {
  const masterKey = loadMasterKey();
  return casesRepository.findById<CasePayload>(id, masterKey);
}

/** Single case with the patient joined in, for the case detail workspace. */
export async function getCaseWithPatientById(id: string) {
  const masterKey = loadMasterKey();
  return casesRepository.findByIdWithPatient<CasePayload>(id, masterKey);
}

/**
 * Save-progress — the patient intake form's autosave/"Save". No status/version
 * change, so it can be called any number of times while the case sits at
 * `sent_to_patient`. `updatePayload` replaces the whole encrypted payload
 * rather than merging, so `existingPayload` (the case's payload as already
 * fetched by the caller, e.g. save-patient-case.ts) carries forward anything
 * else already on it — `positionAppliedFor`, set at case creation, would
 * otherwise be silently wiped the first time the patient saves.
 */
export async function savePatientCaseProgress(
  caseId: string,
  patientCaseData: PatientCaseData,
  existingPayload?: CasePayload | null
): Promise<void> {
  const masterKey = loadMasterKey();
  await casesRepository.updatePayload(caseId, { ...existingPayload, patientCaseData } satisfies CasePayload, masterKey);
}

/**
 * The patient intake form's final Submit — persists the form data, records
 * the chosen doctor on the case's own column (listForClinician/listForPatient
 * filter on it, not the payload), and transitions sent_to_patient ->
 * sent_to_doctor, all atomically (see casesRepository.submitAndTransition —
 * a stale expectedVersion rolls back the payload/clinician writes too,
 * instead of leaving the submission looking silently lost). Unlike the old
 * app, choosing a doctor is mandatory here (medical-office selection was
 * deferred, so there's no "leave it unassigned" path to fall back to).
 */
export async function submitPatientCase(
  caseId: string,
  patientCaseData: PatientCaseData,
  expectedVersion: number,
  actorId: string,
  existingPayload?: CasePayload | null
): Promise<number> {
  const masterKey = loadMasterKey();
  const payload = { ...existingPayload, patientCaseData } satisfies CasePayload;

  const { newVersion, previousStatus } = await casesRepository.submitAndTransition(
    {
      caseId,
      payload,
      assignedClinicianId: patientCaseData.assignedClinicianId,
      expectedVersion,
      newStatus: 'sent_to_doctor',
      actorId
    },
    masterKey
  );

  await finalizeCaseTransition(caseId, actorId, previousStatus, 'sent_to_doctor');

  return newVersion;
}

/**
 * The doctor assessment form's autosave — mirrors savePatientCaseProgress's
 * shape (no status/version change, no validation, replace-the-whole-payload
 * carrying the rest of it forward) but for the doctor's side instead of the
 * patient's. Also stamps who last touched the draft and when — a lightweight
 * byline (see MedicalCase.lastEditedById/lastEditedAt), not an audit-log
 * entry; autosave is silent for everyone, doctor included, and stays that
 * way. Set on every save regardless of actor, so the byline reflects the
 * doctor's own edits too, not just a delegate's.
 */
export async function saveDoctorAssessmentDraft(
  caseId: string,
  draft: Record<string, unknown>,
  existingPayload: CasePayload | null | undefined,
  actorId: string
): Promise<void> {
  const masterKey = loadMasterKey();
  await casesRepository.updatePayload(
    caseId,
    { ...existingPayload, doctorAssessmentDraft: draft } satisfies CasePayload,
    masterKey,
    { lastEditedById: actorId, lastEditedAt: new Date() }
  );
}

/** Clears a case's doctor-assessment draft once the real submission has been recorded, so a case later sent back to the doctor stage doesn't resurface stale draft data (see createSubmissionAction). */
export async function clearDoctorAssessmentDraft(caseId: string, existingPayload?: CasePayload | null): Promise<void> {
  const masterKey = loadMasterKey();
  const { doctorAssessmentDraft: _discard, ...rest } = existingPayload ?? {};
  await casesRepository.updatePayload(caseId, rest satisfies CasePayload, masterKey);
}

/** One patient's own cases, for their dashboard/medical history — patientId is a PatientProfile id, not the linked login user id (see candidates-service.ts's listCandidatesForUser for that mapping). Typed with CasePayload so callers can tell a never-opened case (no `patientCaseData` yet) from one the patient has already started or finished. */
export async function listCasesForPatient(patientId: string) {
  const masterKey = loadMasterKey();
  return casesRepository.listForPatient<CasePayload>(patientId, masterKey);
}

/**
 * Optimistic-concurrency status transition via the transition_medical_case
 * stored procedure (packages/database's casesRepository.transition) — on a
 * stale expectedVersion this throws, which callers should surface as a
 * conflict rather than retry blindly. Every caller (patient submit, doctor
 * completing HR review, the guided "Case actions" menu) routes through here
 * rather than the raw repository method, so every stage change — who moved
 * it, and from/to which status — lands in the audit trail (the case
 * workspace's History tab) with nothing to remember to wire up separately.
 */
export async function transitionCase(
  caseId: string,
  expectedVersion: number,
  newStatus: CaseStatus,
  actorId: string
): Promise<number> {
  const masterKey = loadMasterKey();
  const before = await casesRepository.findById(caseId, masterKey);
  // A canceled case (whether HR withdraws it or a doctor declines it) is never payable — mirrors
  // the legacy app's normalizeCasePaymentStatus. Applied inside transition_medical_case itself
  // (the same stored procedure the version-checked transition below already runs through), not as
  // a separate UPDATE afterward — a prior version did that as two statements, which could leave a
  // withdrawn/canceled case with a stale payable payment_status if the second one failed.
  const newVersion = await casesRepository.transition(caseId, expectedVersion, newStatus, actorId);
  await finalizeCaseTransition(caseId, actorId, before?.status ?? null, newStatus);

  return newVersion;
}

/**
 * The audit + notification side effects of a case transition, shared between transitionCase above
 * (which also performs the DB transition itself) and createSubmissionAndTransitionCase
 * (submissions-service.ts, whose transition already happened inside its own DB transaction via
 * submissionsRepository.saveAndTransition — this only runs after that transaction has committed).
 * Deliberately not run inside a DB transaction itself: an audit write and an outgoing email are
 * side effects of a committed transition, not part of the atomicity guarantee for it.
 */
export async function finalizeCaseTransition(
  caseId: string,
  actorId: string,
  previousStatus: string | null,
  newStatus: CaseStatus
): Promise<void> {
  await auditRepository.append({
    eventType: 'case_transition',
    actorUserId: actorId,
    entityType: 'case',
    entityId: caseId,
    details: { from: previousStatus, to: newStatus }
  });

  await notifyOnTransition(newStatus, caseId);
}

/**
 * Fires the matching notification template (see features/notifications/registry.ts) for the
 * four case-lifecycle events that have one — sendNotification itself never throws (a
 * misconfigured/offline mail server, or a disabled template, never blocks or fails a real case
 * transition), so this is safe to await directly rather than needing its own try/catch here.
 */
async function notifyOnTransition(newStatus: CaseStatus, caseId: string): Promise<void> {
  const masterKey = loadMasterKey();
  const medicalCase = await casesRepository.findById(caseId, masterKey);
  if (!medicalCase) return;

  const settings = await getSettings();

  if (newStatus === 'doctor_submitted') {
    const candidate = await getCandidateById(medicalCase.patientId);
    await sendNotification({
      templateKey: 'case_doctor_submitted',
      to: settings.notifications.reviewerNotificationEmail,
      variables: { caseId, patientName: candidate?.fullName ?? 'the patient' },
      entityType: 'case',
      entityId: caseId
    });
  } else if (newStatus === 'reviewed' || newStatus === 'sent_to_doctor') {
    const doctor = medicalCase.assignedClinicianId ? await usersRepository.findById(medicalCase.assignedClinicianId) : null;
    if (!doctor?.email) return;
    const candidate = await getCandidateById(medicalCase.patientId);
    await sendNotification({
      templateKey: newStatus === 'reviewed' ? 'case_reviewed' : 'case_moved_forward',
      to: doctor.email,
      extraCc: settings.notifications.doctorNotificationEmail,
      variables: { caseId, patientName: candidate?.fullName ?? 'the patient', doctorName: doctor.displayName },
      entityType: 'case',
      entityId: caseId
    });
  } else if (newStatus === 'sent_to_patient') {
    const candidate = await getCandidateById(medicalCase.patientId);
    if (!candidate?.email) return;
    await sendNotification({
      templateKey: 'case_sent_back',
      to: candidate.email,
      variables: { caseId, patientName: candidate.fullName },
      entityType: 'case',
      entityId: caseId
    });
  }
}

/**
 * Changes which doctor a case is assigned to without touching its status —
 * distinct from a stage transition (see case-transitions.ts) since a case
 * can be reassigned while just sitting in a doctor's inbox, nothing about
 * its stage in the workflow actually changing.
 */
export async function reassignClinician(caseId: string, newClinicianId: string, actorId: string): Promise<void> {
  const masterKey = loadMasterKey();
  const before = await casesRepository.findById(caseId, masterKey);
  await casesRepository.setAssignedClinician(caseId, newClinicianId);
  await auditRepository.append({
    eventType: 'case_reassigned',
    actorUserId: actorId,
    entityType: 'case',
    entityId: caseId,
    details: { from: before?.assignedClinicianId ?? null, to: newClinicianId }
  });
}

/** The case workspace's History tab — every transition/reassignment recorded against this case, most recent first. */
export async function listCaseAuditEvents(caseId: string) {
  return auditRepository.listForEntity('case', caseId);
}

/**
 * An admin/reviewer's manual override of a case's billed amount/status (see
 * actions/update-case-billing.ts) — the doctor-submission snapshot (their *current* rate at
 * submission time) is a separate write inside submissionsRepository.saveAndTransition's own
 * transaction, not this function. Deliberately just writes whatever it's given rather than
 * reading a doctor's live rate itself — that's what keeps a case's billed amount loosely coupled
 * from a doctor's rate changing afterward.
 */
export async function setCaseBilling(
  caseId: string,
  payableAmount: number | null,
  paymentStatus: string | null,
  actorId: string
): Promise<void> {
  await casesRepository.setBilling(caseId, payableAmount, paymentStatus);

  await auditRepository.append({
    eventType: 'case_billing_updated',
    actorUserId: actorId,
    entityType: 'case',
    entityId: caseId,
    details: { payableAmount, paymentStatus }
  });
}

/** Statuses reached before a doctor has actually submitted an assessment — a case's billed amount/payment status don't exist yet at any of these (create-submission.ts snapshots the billed amount only at submission time), so billing/payment controls should stay disabled until past this set. */
const PRE_DOCTOR_STATUSES = new Set(['draft', 'sent_to_patient', 'patient_completed', 'sent_to_doctor']);

/** Whether a case has progressed far enough for billing/payment to make sense — see PRE_DOCTOR_STATUSES above. */
export function hasDoctorSubmitted(status: string): boolean {
  return !PRE_DOCTOR_STATUSES.has(status);
}

/** A case has doctor work done but isn't finished with HR yet if it's landed on HR's desk (`doctor_submitted`) or HR has signed off but the doctor hasn't been paid yet (`reviewed`, `paymentStatus !== 'paid'`) — see listReviewQueueCases below for where this actually drives the queue. */
export const REVIEW_QUEUE_STATUSES = ['doctor_submitted', 'reviewed'] as const;

/** The review queue itself: every case that's passed through a doctor's assessment and isn't fully closed out yet — HR hasn't completed their review, or has but the doctor hasn't been paid. Once paid, it drops off here and is only reachable read-only from the full /cases list. */
export async function listReviewQueueCases() {
  const cases = await listCasesWithPatient();
  return cases.filter(
    (medicalCase) =>
      (REVIEW_QUEUE_STATUSES as readonly string[]).includes(medicalCase.status) && medicalCase.paymentStatus !== 'paid'
  );
}

/**
 * Marks a case as paid and records who confirmed it and for what date — kept
 * as an audit event (`case_payment_confirmed`) rather than new columns on the
 * case itself, the same way a stage transition or reassignment is recorded,
 * so "who confirmed payment, and when" shows up in the case's own History
 * tab for free. `paidOn` is the date the payment actually happened (which a
 * reviewer might be recording after the fact), not necessarily today, the
 * day they're clicking this.
 */
export async function confirmCasePayment(caseId: string, paidOn: string, actorId: string): Promise<void> {
  await casesRepository.confirmPayment(caseId, new Date(paidOn));
  await auditRepository.append({
    eventType: 'case_payment_confirmed',
    actorUserId: actorId,
    entityType: 'case',
    entityId: caseId,
    details: { paidOn }
  });

  const masterKey = loadMasterKey();
  const medicalCase = await casesRepository.findById(caseId, masterKey);
  const doctor = medicalCase?.assignedClinicianId ? await usersRepository.findById(medicalCase.assignedClinicianId) : null;
  if (!doctor?.email) return;

  const settings = await getSettings();
  const candidate = medicalCase ? await getCandidateById(medicalCase.patientId) : null;
  await sendNotification({
    templateKey: 'case_payment_confirmed',
    to: doctor.email,
    extraCc: settings.notifications.doctorNotificationEmail,
    variables: { caseId, patientName: candidate?.fullName ?? 'the patient', paidOn },
    entityType: 'case',
    entityId: caseId
  });
}

/**
 * Toggles a case's queue visibility without touching its status — distinct
 * from the 'cancel' action (case-transitions.ts), which actually ends a
 * case. A reviewer can park a case out of the doctor/patient queues (see
 * doctor-dashboard-service.ts's inbox filter and patient-dashboard-
 * service.ts) and un-hide it later with the case picking up exactly where
 * it left off. Recorded as an audit event for the History tab, same as any
 * other case-affecting action, even though the flag itself lives in the
 * payload rather than its own column.
 */
export async function setCaseHidden(
  caseId: string,
  hidden: boolean,
  actorId: string,
  existingPayload?: CasePayload | null
): Promise<void> {
  const masterKey = loadMasterKey();
  await casesRepository.updatePayload(caseId, { ...existingPayload, hidden } satisfies CasePayload, masterKey);
  await auditRepository.append({
    eventType: hidden ? 'case_hidden' : 'case_unhidden',
    actorUserId: actorId,
    entityType: 'case',
    entityId: caseId,
    details: {}
  });
}

/** Case counts for a clinician's Doctor row (see features/users' role-users-container.tsx) — total assigned vs. still-active (not yet reviewed/archived/canceled/withdrawn). */
export async function countCasesForClinician(clinicianId: string): Promise<{ total: number; active: number }> {
  const masterKey = loadMasterKey();
  const cases = await casesRepository.listForClinician(clinicianId, masterKey);
  const closedStatuses = new Set(['reviewed', 'archived', 'canceled_by_doctor', 'withdrawn']);
  const active = cases.filter((item) => !closedStatuses.has(item.status)).length;
  return { total: cases.length, active };
}
