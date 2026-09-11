'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { createActionRateLimiter } from '../../../lib/action-rate-limit';
import { combineContactNumbers } from '../../../lib/phone-number';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { selfProfileSchema } from '../schemas/self-profile';
import { listCandidatesForUser, updateCandidate } from '../services/candidates-service';

export interface UpdateOwnProfileResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
}

/** 20 per 10 minutes — a patient only ever has one profile to save, so this is purely a brake on repeated-submission spam, not a real workflow constraint. */
const updateOwnProfileLimiter = createActionRateLimiter('update-own-profile', 20, 10 * 60 * 1000);

/**
 * The "My profile" page's own save action, for a patient/candidate editing
 * their own contact details. Deliberately never accepts a candidate id from
 * the form — unlike updateCandidateAction (the HR-facing /candidates/[id]
 * form, which trusts a hidden `candidateId` field because only admin/
 * reviewer/auditor can ever reach that page), this resolves the candidate
 * to edit from the caller's own session via listCandidatesForUser, so a
 * patient can never target anyone's profile but their own regardless of
 * what a request claims.
 */
export async function updateOwnProfileAction(
  _prevState: UpdateOwnProfileResult | null,
  formData: FormData
): Promise<UpdateOwnProfileResult> {
  await assertSameOrigin();

  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.PATIENT_PROFILES_UPDATE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  if (await updateOwnProfileLimiter.isLimited(session.user.id)) {
    return { ok: false, error: 'Too many attempts — please wait a few minutes and try again.' };
  }
  await updateOwnProfileLimiter.recordAttempt(session.user.id);

  const own = (await listCandidatesForUser(session.user.id))[0];
  if (!own) {
    return { ok: false, error: 'No candidate profile is linked to your account.' };
  }

  const parsed = selfProfileSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    contactNumber: combineContactNumbers(formData)
  });
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const fieldErrors = Object.fromEntries(
      Object.entries(flattened)
        .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
        .map(([field, messages]) => [field, messages[0]!])
    );
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid profile details.', fieldErrors };
  }

  await updateCandidate(own.id, parsed.data);

  revalidatePath('/profile');
  return { ok: true, message: 'Profile updated.' };
}
