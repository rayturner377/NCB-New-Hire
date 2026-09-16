'use server';

import { revalidatePath } from 'next/cache';
import { CaseVersionConflictError } from '@ncb/database';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { parseNestedFormData } from '../../../lib/form-data-to-object';
import { ForbiddenError, PERMISSIONS, ROLES, requirePermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { ownsCase } from '../../cases/case-authorization';
import { getCaseById, saveDoctorAssessmentDraft } from '../../cases/services/cases-service';

export interface SaveSubmissionDraftResult {
  ok: boolean;
  error?: string;
  /** The version the draft was saved at — the client updates its own tracked version to this after every successful save, so the NEXT save's caseVersion is never stale. Absent on failure. */
  newVersion?: number;
}

/**
 * The doctor assessment form's autosave target — same shape as
 * save-patient-case.ts's draft path: no validation (a doctor mid-assessment
 * can leave anything blank), no status change, just a snapshot of whatever's
 * currently in the form. Lets the doctor dashboard tell "never opened" from
 * "started but not submitted" (see doctor-case-table.tsx) and lets the
 * doctor pick back up where they left off.
 *
 * `caseVersion` is read from the client's own form (same field
 * create-submission.ts's real submit already uses), not re-fetched fresh
 * here — confirmed via external security review that re-fetching made the
 * version check a no-op, since it would always trivially match itself.
 * Every successful save returns `newVersion` specifically so the client can
 * update what it sends on the NEXT autosave — see doctor-case-form.tsx's own
 * handling of this result.
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
  const expectedVersion = Number.parseInt(String(formData.get('caseVersion') || ''), 10);
  if (!caseId || !Number.isFinite(expectedVersion)) {
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

  // Defense in depth: the UI never renders the Determination & Attestation tab's fields for a
  // delegate (see doctor-case-form.tsx), but this action still receives the whole form's FormData
  // in one request — strip them here too rather than trusting the client not to have sent them.
  if (session.user.role === ROLES.DELEGATE) {
    delete draft.determination;
    delete draft.attestation;
  }

  let newVersion: number;
  try {
    newVersion = await saveDoctorAssessmentDraft(caseId, draft, medicalCase.payload, session.user.id, expectedVersion);
  } catch (error) {
    if (error instanceof CaseVersionConflictError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
  revalidatePath(`/cases/${caseId}`);
  return { ok: true, newVersion };
}
