'use server';

import { redirect } from 'next/navigation';
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

  await changePassword(session.user.id, parsed.data.password, session.sessionId);
  redirect('/');
}
