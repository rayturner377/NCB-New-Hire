'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { createActionRateLimiter } from '../../../lib/action-rate-limit';
import { combineFullName } from '../../../lib/full-name';
import { combineContactNumbers } from '../../../lib/phone-number';
import { ForbiddenError, PERMISSIONS, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { DuplicateEmailError } from '../../users/services/users-service';
import { createCandidateSchema } from '../schemas/candidate';
import { createCandidate } from '../services/candidates-service';

export interface CandidateActionResult {
  ok: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
}

/** 30 per 10 minutes per user — generous for HR onboarding a real batch of candidates, still bounds runaway/scripted profile creation. */
const createCandidateLimiter = createActionRateLimiter(30, 10 * 60 * 1000);

/** On success this redirects to the new candidate's page (a dedicated /candidates/new page, not an inline form) and never returns. */
export async function createCandidateAction(
  _prevState: CandidateActionResult | null,
  formData: FormData
): Promise<CandidateActionResult> {
  await assertSameOrigin();

  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.PATIENT_PROFILES_CREATE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  if (createCandidateLimiter.isLimited(session.user.id)) {
    return { ok: false, error: 'Too many candidates created recently — please wait a few minutes and try again.' };
  }
  createCandidateLimiter.recordAttempt(session.user.id);

  const fields = Object.fromEntries(formData.entries());
  const parsed = createCandidateSchema.safeParse({
    ...fields,
    fullName: combineFullName(formData),
    contactNumber: combineContactNumbers(formData)
  });
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const fieldErrors = Object.fromEntries(
      Object.entries(flattened)
        .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
        .map(([field, messages]) => [field, messages[0]!])
    );
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid candidate details.',
      fieldErrors
    };
  }

  let created;
  try {
    created = await createCandidate({
      ...parsed.data,
      createdBy: session.user.id,
      createdByName: session.user.displayName,
      mustChangePassword: formData.get('forcePasswordChange') != null
    });
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      return { ok: false, error: error.message, fieldErrors: { email: error.message } };
    }
    throw error;
  }

  revalidatePath('/candidates');
  redirect(`/candidates/${created.id}`);
}
