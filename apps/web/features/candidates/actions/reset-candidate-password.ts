'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { createActionRateLimiter } from '../../../lib/action-rate-limit';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { resetUserPassword } from '../../users/services/users-service';
import { getCandidateById } from '../services/candidates-service';

export interface ResetCandidatePasswordResult {
  ok: boolean;
  error?: string;
}

/** 10 resets per 15 minutes per acting user — a real HR workflow never needs to reset more than a handful of candidate passwords in a burst; bounds what a compromised/malicious admin session could do. */
const resetPasswordLimiter = createActionRateLimiter('reset-candidate-password', 10, 15 * 60 * 1000);

/**
 * HR triggering a password reset on a candidate's portal account — emails a
 * 6-digit reset code the candidate redeems at /forgot-password to choose
 * their own new password (see AccessCode's doc comment in schema.prisma for
 * why this no longer takes an admin-chosen password). Gated on
 * PATIENT_PROFILES_RESET_PASSWORD, deliberately separate from
 * PATIENT_PROFILES_UPDATE — that permission is also held by `patient` (to
 * edit their own record), and a patient must never be able to reach this
 * HR-facing reset action, even against their own account.
 */
export async function resetCandidatePasswordAction(
  _prevState: ResetCandidatePasswordResult | null,
  formData: FormData
): Promise<ResetCandidatePasswordResult> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.PATIENT_PROFILES_RESET_PASSWORD);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  if (await resetPasswordLimiter.isLimited(session.user.id)) {
    return { ok: false, error: 'Too many password resets — please wait a few minutes and try again.' };
  }
  await resetPasswordLimiter.recordAttempt(session.user.id);

  const candidateId = String(formData.get('candidateId') || '');
  if (!candidateId) {
    return { ok: false, error: 'Missing candidate reference.' };
  }

  const candidate = await getCandidateById(candidateId);
  if (!candidate || !candidate.linkedUserId) {
    return { ok: false, error: "This candidate doesn't have portal access set up yet." };
  }

  await resetUserPassword(candidate.linkedUserId, session.user.id);

  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true };
}
