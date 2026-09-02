'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { parseNestedFormData } from '../../../lib/form-data-to-object';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { getCandidateById } from '../../candidates/services/candidates-service';
import type { CandidatePayload } from '../../candidates/types';
import { getCaseById, transitionCase } from '../../cases/services/cases-service';
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

  const session = await getSession();
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

  await transitionCase(caseId, expectedVersion, 'doctor_submitted', session.user.id);

  revalidatePath('/cases');
  redirect('/cases');
}
