'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { PERMISSIONS, requirePermission, ForbiddenError } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { getCaseById, setCaseHidden } from '../services/cases-service';

export interface SetCaseHiddenResult {
  ok: boolean;
  error?: string;
}

/**
 * Toggles a case out of (or back into) the doctor/patient queues — see
 * cases-service.ts's setCaseHidden for why this is a separate mechanism from
 * the "Cancel case" transition. Takes the target `hidden` value explicitly
 * rather than flipping whatever's currently set, so a stale page can't
 * accidentally undo someone else's hide/unhide.
 */
export async function setCaseHiddenAction(
  _prevState: SetCaseHiddenResult | null,
  formData: FormData
): Promise<SetCaseHiddenResult> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.MEDICAL_CASES_HIDE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  const caseId = String(formData.get('caseId') || '');
  const hidden = String(formData.get('hidden') || '') === 'true';
  if (!caseId) {
    return { ok: false, error: 'Missing case reference.' };
  }

  const medicalCase = await getCaseById(caseId);
  if (!medicalCase) {
    return { ok: false, error: 'Case not found.' };
  }

  await setCaseHidden(caseId, hidden, session.user.id, medicalCase.payload);

  revalidatePath(`/cases/${caseId}`);
  revalidatePath('/cases');
  return { ok: true };
}
