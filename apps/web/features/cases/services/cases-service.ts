import { randomUUID } from 'node:crypto';
import { auditRepository, casesRepository, usersRepository, type CaseSearchFilters } from '@ncb/database';
import { loadMasterKey } from '../../../lib/master-key';
import { getCandidateById } from '../../candidates/services/candidates-service';
import { sendNotification } from '../../notifications/services/notification-service';
import { getSettings } from '../../settings/services/settings-service';
import type { PatientCaseData } from '../patient-case-data';
import type { CreateCaseSchemaInput } from '../schemas/case';
import type { CaseStatus } from '../types';
import { isCaseClosed } from '../case-workflow';

/** Re-exported for the several call sites that already import other case-service functions here alongside it — see case-workflow.ts for the actual (dependency-light) implementation. */
export { hasDoctorSubmitted } from '../case-workflow';

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

/** All cases with the patient's non-encrypted name/employeeId joined in, for the candidates page's per-candidate case history and the dashboard/audit-log aggregate reads that need every case. Prefer searchCasesWithPatient for anything that shows a filterable, paginated list. */
export async function listCasesWithPatient() {
  const masterKey = loadMasterKey();
  return casesRepository.listAllWithPatient<CasePayload>(masterKey);
}

/** The "All cases" tab's actual data source — filters/paginates in SQL (see casesRepository.searchWithPatient) instead of fetching and decrypting every case in the system just to throw most of it away. */
export async function searchCasesWithPatient(filters: CaseSearchFilters, page: number, pageSize: number) {
  const masterKey = loadMasterKey();
  return casesRepository.searchWithPatient<CasePayload>(filters, page, pageSize, masterKey);
}

/** The "All cases" tab's export — same filters as searchCasesWithPatient, every matching row instead of one page. */
export async function searchAllCasesWithPatient(filters: CaseSearchFilters) {
  const masterKey = loadMasterKey();
  return casesRepository.searchAllWithPatient<CasePayload>(filters, masterKey);
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
 * Save-progress — the patient intake form's autosave/"Save". No status
 * change, so it can be called any number of times while the case sits at
 * `sent_to_patient`. `updatePayload` replaces the whole encrypted payload
 * rather than merging, so `existingPayload` (the case's payload as already
 * fetched by the caller, e.g. save-patient-case.ts) carries forward anything
 * else already on it — `positionAppliedFor`, set at case creation, would
 * otherwise be silently wiped the first time the patient saves.
 *
 * `expectedVersion` — the caller's own freshly-read version (see
 * updatePayload's own doc comment on why this is a real, if narrower, guard
 * than a client-round-tripped one) — rejects this save if the case moved on
 * since that read, rather than silently overwriting.
 */
export async function savePatientCaseProgress(
  caseId: string,
  patientCaseData: PatientCaseData,
  existingPayload: CasePayload | null | undefined,
  expectedVersion: number
): Promise<void> {
  const masterKey = loadMasterKey();
  await casesRepository.updatePayload(
    caseId,
    { ...existingPayload, patientCaseData } satisfies CasePayload,
    masterKey,
    undefined,
    expectedVersion
  );
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
 * shape (no status change, no validation, carry the rest of the payload
 * forward) but for the doctor's side instead of the patient's. Also stamps
 * who last touched the draft and when — a lightweight byline (see
 * MedicalCase.lastEditedById/lastEditedAt), not an audit-log entry; autosave
 * is silent for everyone, doctor included, and stays that way. Set on every
 * save regardless of actor, so the byline reflects the doctor's own edits
 * too, not just a delegate's.
 *
 * `doctorAssessmentDraft` itself is shallow-merged, not replaced wholesale —
 * confirmed via real code reading that a full replace here was a real,
 * always-reproducible bug: save-submission-draft.ts's own defense-in-depth
 * strips `determination`/`attestation` out of a delegate's own posted draft
 * (a delegate must never set those, even if the client somehow sent them),
 * but a delegate saving AFTER the doctor had already filled those fields in
 * would silently erase them from the stored record, since a full replace of
 * doctorAssessmentDraft has no way to know they were ever there. A shallow
 * merge only touches keys actually present in the incoming `draft`, so an
 * absent key (deleted, not merely blank) leaves whatever was already stored
 * untouched.
 *
 * `expectedVersion` MUST be the version the caller's OWN editor actually last saw (the value their
 * form was rendered with, or the value handed back from THEIR OWN previous save) — not one freshly
 * re-read by the server in the same request. Confirmed via external security review that using a
 * freshly-fetched version here made the check a no-op: updatePayload now genuinely increments
 * `version` on every write, so re-reading it moments before checking against itself would always
 * trivially match, defeating the whole point. Returns the new version so the caller (save-
 * submission-draft.ts) can hand it back to the client, which is what lets a doctor's own repeated
 * autosaves keep advancing their own locally-tracked version instead of forever resubmitting a
 * stale one and spuriously conflicting with themselves.
 */
export async function saveDoctorAssessmentDraft(
  caseId: string,
  draft: Record<string, unknown>,
  existingPayload: CasePayload | null | undefined,
  actorId: string,
  expectedVersion: number
): Promise<number> {
  const masterKey = loadMasterKey();
  const mergedDraft = { ...existingPayload?.doctorAssessmentDraft, ...draft };
  const updated = await casesRepository.updatePayload(
    caseId,
    { ...existingPayload, doctorAssessmentDraft: mergedDraft } satisfies CasePayload,
    masterKey,
    { lastEditedById: actorId, lastEditedAt: new Date() },
    expectedVersion
  );
  return updated.version;
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

/** The candidates list's per-candidate case-count/history summary — scoped to just the given patient ids (e.g. the current page's candidates) via SQL `IN`, not every case in the system. */
export async function listCasesForPatients(patientIds: string[]) {
  const masterKey = loadMasterKey();
  return casesRepository.listForPatients<CasePayload>(patientIds, masterKey);
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
  actorId: string,
  reason?: string
): Promise<number> {
  const masterKey = loadMasterKey();
  const before = await casesRepository.findById(caseId, masterKey);
  // A canceled case (whether HR withdraws it or a doctor declines it) is never payable — mirrors
  // the legacy app's normalizeCasePaymentStatus. A case reopened back to sent_to_doctor/
  // sent_to_patient after being paid has its payment reset the same way (see
  // 0028_reset_payment_on_case_reopen) — it shouldn't keep showing as paid while the assessment
  // it was paid for is being redone. Both applied inside transition_medical_case itself (the same
  // stored procedure the version-checked transition below already runs through), not as a separate
  // UPDATE afterward — a prior version did the cancel-reset as two statements, which could leave a
  // withdrawn/canceled case with a stale payable payment_status if the second one failed.
  const newVersion = await casesRepository.transition(caseId, expectedVersion, newStatus, actorId);
  await finalizeCaseTransition(caseId, actorId, before?.status ?? null, newStatus, reason);

  return newVersion;
}

/**
 * The audit + notification side effects of a case transition, shared between transitionCase above
 * (which also performs the DB transition itself) and createSubmissionAndTransitionCase
 * (submissions-service.ts, whose transition already happened inside its own DB transaction via
 * submissionsRepository.saveAndTransition — this only runs after that transaction has committed).
 * Deliberately not run inside a DB transaction itself: an audit write and an outgoing email are
 * side effects of a committed transition, not part of the atomicity guarantee for it. `reason` is
 * only ever set for a paid-case reopen (case-transitions.ts's REOPEN_TO_DOCTOR/REOPEN_TO_PATIENT) —
 * omitted from `details` entirely for an ordinary transition rather than stored as null noise.
 */
export async function finalizeCaseTransition(
  caseId: string,
  actorId: string,
  previousStatus: string | null,
  newStatus: CaseStatus,
  reason?: string
): Promise<void> {
  await auditRepository.append({
    eventType: 'case_transition',
    actorUserId: actorId,
    entityType: 'case',
    entityId: caseId,
    details: { from: previousStatus, to: newStatus, ...(reason ? { reason } : {}) }
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
 * Fixes an already-confirmed payment date without touching paymentStatus or the case's own status
 * — a plain re-run of confirmPayment's own DB write (still 'paid', just a different date) is exactly
 * right here, but the audit trail deliberately uses its own case_payment_corrected event type
 * (rather than another case_payment_confirmed) so a correction never reads as a second, separate
 * confirmation, and always carries the reason it happened. No notification email — this is a
 * paperwork fix, not a new payment event the doctor needs to hear about again.
 */
export async function correctCasePaymentDate(caseId: string, paidOn: string, reason: string, actorId: string): Promise<void> {
  await casesRepository.confirmPayment(caseId, new Date(paidOn));
  await auditRepository.append({
    eventType: 'case_payment_corrected',
    actorUserId: actorId,
    entityType: 'case',
    entityId: caseId,
    details: { paidOn, reason }
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
  existingPayload: CasePayload | null | undefined,
  expectedVersion: number
): Promise<void> {
  const masterKey = loadMasterKey();
  await casesRepository.updatePayload(caseId, { ...existingPayload, hidden } satisfies CasePayload, masterKey, undefined, expectedVersion);
  await auditRepository.append({
    eventType: hidden ? 'case_hidden' : 'case_unhidden',
    actorUserId: actorId,
    entityType: 'case',
    entityId: caseId,
    details: {}
  });
}

/**
 * Case counts for a page of doctors' rows (see features/users' role-users-container.tsx and
 * doctors-workspace-container.tsx) — total assigned vs. still-active (not yet reviewed/archived/
 * canceled/withdrawn) per clinician, in one query rather than one per doctor on the page.
 */
export async function countCasesForClinicians(
  clinicianIds: string[]
): Promise<Record<string, { total: number; active: number }>> {
  const statusesByClinicianId = await casesRepository.listStatusesByClinicianId(clinicianIds);
  const counts: Record<string, { total: number; active: number }> = {};
  for (const clinicianId of clinicianIds) {
    const statuses = statusesByClinicianId.get(clinicianId) ?? [];
    counts[clinicianId] = { total: statuses.length, active: statuses.filter((status) => !isCaseClosed(status)).length };
  }
  return counts;
}
