'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { parseNestedFormData } from '../../../lib/form-data-to-object';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { getCandidateById } from '../../candidates/services/candidates-service';
import type { CandidatePayload } from '../../candidates/types';
import { ownsCase } from '../../cases/case-authorization';
import { clearDoctorAssessmentDraft, getCaseById, setCaseBilling, transitionCase } from '../../cases/services/cases-service';
import { createSubmissionSchema } from '../schemas/submission';
import { createSubmission } from '../services/submissions-service';

export interface SubmissionActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Candidate identity fields come from the fetched candidate record, not the
 * client-submitted form — a doctor filling out an assessment shouldn't be
 * able to alter whose record it's attached to.
 */
function candidateSummaryFrom(candidate: CandidatePayload) {
  return {
    candidateId: candidate.id,
    caseId: '',
    patientId: candidate.id,
    fullName: candidate.fullName,
    employeeId: candidate.employeeId,
    nationalId: candidate.nationalId,
    dateOfBirth: candidate.dateOfBirth,
    email: candidate.email,
    contactNumber: candidate.contactNumber,
    position: candidate.position,
    medicationInformation: candidate.medicationInformation
  };
}

export async function createSubmissionAction(
  _prevState: SubmissionActionResult | null,
  formData: FormData
): Promise<SubmissionActionResult> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.SUBMISSIONS_CREATE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  const caseId = String(formData.get('caseId') || '');
  const expectedVersion = Number.parseInt(String(formData.get('caseVersion') || ''), 10);
  if (!caseId || !Number.isFinite(expectedVersion)) {
    return { ok: false, error: 'Missing or invalid case reference.' };
  }

  const medicalCase = await getCaseById(caseId);
  if (!medicalCase) {
    return { ok: false, error: 'That case could not be found.' };
  }
  if (!ownsCase(session.user, medicalCase)) {
    return { ok: false, error: 'This case is not assigned to you.' };
  }

  const candidate = await getCandidateById(medicalCase.patientId);
  if (!candidate) {
    return { ok: false, error: 'The candidate for this case could not be found.' };
  }

  const raw = parseNestedFormData(formData);
  const parsed = createSubmissionSchema.safeParse({ ...raw, candidate: candidateSummaryFrom(candidate) });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid assessment details.' };
  }

  await createSubmission({
    ...parsed.data,
    caseId,
    submittedBy: session.user.id,
    submittedByName: session.user.displayName,
    submittedByEmail: session.user.email
  });

  // Snapshots the doctor's *current* rate onto the case at the moment they submit — a fixed
  // amount from here on, independent of the doctor's own rate changing later (only an admin can
  // adjust it after this point, see actions/update-case-billing.ts). A rate of 0 (unset, or a
  // clinician/support account with no billable rate) leaves payableAmount alone rather than
  // writing a misleading $0.00.
  const medicalProfile = session.user.medicalProfile as { defaultMedicalFee?: number } | null;
  const doctorRate = Number(medicalProfile?.defaultMedicalFee);
  if (Number.isFinite(doctorRate) && doctorRate > 0) {
    await setCaseBilling(caseId, doctorRate, 'unpaid');
  }

  await transitionCase(caseId, expectedVersion, 'doctor_submitted', session.user.id);
  // The draft's job is done — clearing it now means a future "send back to the doctor" on this
  // same case starts from a blank assessment, not this now-superseded draft snapshot.
  await clearDoctorAssessmentDraft(caseId, medicalCase.payload);

  revalidatePath('/cases');
  return { ok: true };
}
