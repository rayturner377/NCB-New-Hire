'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { createActionRateLimiter } from '../../../lib/action-rate-limit';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { changePasswordSchema } from '../../auth/schemas/change-password';
import { validatePasswordAgainstPolicy } from '../../settings/password-policy';
import { getSettings } from '../../settings/services/settings-service';
import { resetUserPassword } from '../../users/services/users-service';
import { getCandidateById } from '../services/candidates-service';

export interface ResetCandidatePasswordResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** 10 resets per 15 minutes per acting user — a real HR workflow never needs to reset more than a handful of candidate passwords in a burst; bounds what a compromised/malicious admin session could do. */
const resetPasswordLimiter = createActionRateLimiter('reset-candidate-password', 10, 15 * 60 * 1000);

/**
 * HR setting a new temporary password on a candidate's portal account —
 * covers both "they forgot it" and "we mistyped it at creation" (there was
 * previously no way to do either once the account existed — only at creation
 * time). Gated on PATIENT_PROFILES_RESET_PASSWORD, deliberately separate
 * from PATIENT_PROFILES_UPDATE — that permission is also held by `patient`
 * (to edit their own record), and a patient must never be able to reach
 * this HR-facing reset action, even against their own account.
 */
export async function resetCandidatePasswordAction(
  _prevState: ResetCandidatePasswordResult | null,
  formData: FormData
): Promise<ResetCandidatePasswordResult> {
  await assertSameOrigin();

  const session = await getSession();
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

  const parsed = changePasswordSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const fieldErrors = Object.fromEntries(
      Object.entries(flattened)
        .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
        .map(([field, messages]) => [field, messages[0]!])
    );
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid password.', fieldErrors };
  }

  const { userPolicy } = await getSettings();
  const policyError = validatePasswordAgainstPolicy(parsed.data.password, userPolicy);
  if (policyError) {
    return { ok: false, error: policyError, fieldErrors: { password: policyError } };
  }

  const candidate = await getCandidateById(candidateId);
  if (!candidate || !candidate.linkedUserId) {
    return { ok: false, error: "This candidate doesn't have portal access set up yet." };
  }

  const mustChangePassword = formData.get('forcePasswordChange') != null;
  await resetUserPassword(candidate.linkedUserId, parsed.data.password, mustChangePassword, session.user.id);

  revalidatePath(`/candidates/${candidateId}`);
  return { ok: true };
}
