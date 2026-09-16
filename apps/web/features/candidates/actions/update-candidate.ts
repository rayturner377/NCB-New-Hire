'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { fieldErrorsFrom } from '../../../lib/field-errors';
import { combineContactNumbers } from '../../../lib/phone-number';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { requireOwnsCandidate } from '../candidate-authorization';
import { updateCandidateSchema } from '../schemas/candidate';
import { updateCandidate } from '../services/candidates-service';
import type { CandidateActionResult } from './create-candidate';

/**
 * The "View candidate" page's editable personal-info form — same shape as
 * create-candidate.ts but patches an existing profile instead of creating
 * one, and stays on the page (no redirect) so HR can keep editing after a
 * save. Full name here is a single field rather than NameFields' split
 * pair, since the profile already exists as one `fullName` string and
 * splitting/rejoining it on every edit isn't worth the churn.
 */
export async function updateCandidateAction(
  _prevState: CandidateActionResult | null,
  formData: FormData
): Promise<CandidateActionResult> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.PATIENT_PROFILES_UPDATE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  const candidateId = String(formData.get('candidateId') || '');
  if (!candidateId) {
    return { ok: false, error: 'Missing candidate id.' };
  }

  try {
    await requireOwnsCandidate(session.user, candidateId);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  const fields = Object.fromEntries(formData.entries());
  const parsed = updateCandidateSchema.safeParse({
    ...fields,
    contactNumber: combineContactNumbers(formData)
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid candidate details.',
      fieldErrors: fieldErrorsFrom(parsed.error)
    };
  }

  await updateCandidate(candidateId, parsed.data, session.user.id);

  revalidatePath(`/candidates/${candidateId}`);
  revalidatePath('/candidates');
  return { ok: true, message: 'Candidate profile updated.' };
}
