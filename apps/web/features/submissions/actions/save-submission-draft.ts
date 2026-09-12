'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { parseNestedFormData } from '../../../lib/form-data-to-object';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { ownsCase } from '../../cases/case-authorization';
import { getCaseById, saveDoctorAssessmentDraft } from '../../cases/services/cases-service';

export interface SaveSubmissionDraftResult {
  ok: boolean;
  error?: string;
}

/**
 * The doctor assessment form's autosave target — same shape as
 * save-patient-case.ts's draft path: no validation (a doctor mid-assessment
 * can leave anything blank), no status/version change, just a snapshot of
 * whatever's currently in the form. Lets the doctor dashboard tell "never
 * opened" from "started but not submitted" (see doctor-case-table.tsx) and
 * lets the doctor pick back up where they left off.
 */
export async function saveSubmissionDraftAction(
  _prevState: SaveSubmissionDraftResult | null,
  formData: FormData
): Promise<SaveSubmissionDraftResult> {
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
  if (!caseId) {
    return { ok: false, error: 'Missing case reference.' };
  }

  const medicalCase = await getCaseById(caseId);
  if (!medicalCase) {
    return { ok: false, error: 'That case could not be found.' };
  }
  if (!ownsCase(session.user, medicalCase)) {
    return { ok: false, error: 'This case is not assigned to you.' };
  }
  if (medicalCase.status !== 'sent_to_doctor') {
    return { ok: false, error: 'This case is not currently awaiting your assessment.' };
  }

  const draft = parseNestedFormData(formData);
  delete draft.caseId;
  delete draft.caseVersion;

  await saveDoctorAssessmentDraft(caseId, draft, medicalCase.payload);
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
