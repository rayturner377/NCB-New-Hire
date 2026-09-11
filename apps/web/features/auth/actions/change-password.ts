'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@ncb/auth';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { getSession } from '../../../lib/session';
import { validatePasswordAgainstPolicy } from '../../settings/password-policy';
import { getSettings } from '../../settings/services/settings-service';
import { changePassword } from '../../users/services/users-service';
import { changePasswordSchema } from '../schemas/change-password';

export interface ChangePasswordResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

/** The forced first-login password change — see lib/session.ts's AuthenticatedSession.user.mustChangePassword and app/change-password/page.tsx. */
export async function changePasswordAction(
  _prevState: ChangePasswordResult | null,
  formData: FormData
): Promise<ChangePasswordResult> {
  await assertSameOrigin();

  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
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

  await changePassword(session.user.id, parsed.data.password);
  // Kills every other active session on this account (the caller's own,
  // current session is deliberately kept alive) — same reasoning as before
  // Better Auth: if the old password had leaked, that session dies now
  // instead of staying valid until it naturally expires. Needs the request's
  // own headers/cookie to know which session is "current."
  await auth.api.revokeOtherSessions({ headers: await headers() });
  redirect('/');
}
