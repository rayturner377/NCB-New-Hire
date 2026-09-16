'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { createActionRateLimiter } from '../../../lib/action-rate-limit';
import { fieldErrorsFrom } from '../../../lib/field-errors';
import { combineFullName } from '../../../lib/full-name';
import { combineMedicalProfile } from '../../../lib/medical-profile';
import { ForbiddenError, requireCanManageUserAccount } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { LIST_PATH_BY_ROLE } from '../../../lib/role-list-paths';
import { activationCodeTtlMinutesFor } from '../../auth/activation-code-ttl';
import { createUserSchema } from '../schemas/user';
import { createUser, DuplicateEmailError } from '../services/users-service';

export interface UserActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** 20 per 15 minutes per admin — staff accounts are created far less often than candidates/cases; also doubles as a brake on the account_created email that fires per creation. */
const createUserLimiter = createActionRateLimiter('create-user', 20, 15 * 60 * 1000);

export async function createUserAction(
  _prevState: UserActionResult | null,
  formData: FormData
): Promise<UserActionResult> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  // Read straight off formData rather than waiting for createUserSchema's own validation below —
  // an unauthorized request should be rejected before anything else, including telling the caller
  // which other fields are invalid.
  try {
    requireCanManageUserAccount(session.user, String(formData.get('role') || ''));
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  if (await createUserLimiter.isLimited(session.user.id)) {
    return { ok: false, error: 'Too many accounts created recently — please wait a few minutes and try again.' };
  }
  await createUserLimiter.recordAttempt(session.user.id);

  const parsed = createUserSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    displayName: combineFullName(formData)
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid user details.',
      fieldErrors: fieldErrorsFrom(parsed.error)
    };
  }

  const activationCodeTtlMinutes = activationCodeTtlMinutesFor(String(formData.get('activationCodeTtl') || ''));

  let created;
  try {
    created = await createUser(
      {
        ...parsed.data,
        medicalProfile: parsed.data.role === 'clinician' ? combineMedicalProfile(formData) : undefined,
        activationCodeTtlMs: activationCodeTtlMinutes ? activationCodeTtlMinutes * 60 * 1000 : undefined
      },
      session.user.id
    );
  } catch (error) {
    if (error instanceof DuplicateEmailError) {
      return { ok: false, error: error.message, fieldErrors: { email: error.message } };
    }
    throw error;
  }

  const listPath = LIST_PATH_BY_ROLE[created.role] ?? '/cases';
  revalidatePath(listPath);
  redirect(listPath);
}
