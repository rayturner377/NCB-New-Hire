'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { combineFullName } from '../../../lib/full-name';
import { combineMedicalProfile } from '../../../lib/medical-profile';
import { ForbiddenError, requireCanManageUserAccount } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { updateUserSchema } from '../schemas/user';
import { getUserRole, updateUser } from '../services/users-service';

export interface UpdateUserActionResult {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function updateUserAction(
  _prevState: UpdateUserActionResult | null,
  formData: FormData
): Promise<UpdateUserActionResult> {
  await assertSameOrigin();

  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  const userId = String(formData.get('userId') || '');
  if (!userId) {
    return { ok: false, error: 'Missing user id.' };
  }

  // The target's role must come from the database, never the client (the form's own `role` field
  // is only a fixed hidden input mirroring what the account already is, not something this action
  // should trust for an authorization decision) — see delete-user.ts's own comment on the same
  // lookup.
  const targetRole = await getUserRole(userId);
  if (!targetRole) {
    return { ok: false, error: 'User not found.' };
  }

  try {
    requireCanManageUserAccount(session.user, targetRole);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  const parsed = updateUserSchema.safeParse({ displayName: combineFullName(formData) });
  if (!parsed.success) {
    const flattened = parsed.error.flatten().fieldErrors;
    const fieldErrors = Object.fromEntries(
      Object.entries(flattened)
        .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
        .map(([field, messages]) => [field, messages[0]!])
    );
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid details.', fieldErrors };
  }

  await updateUser(userId, {
    ...parsed.data,
    medicalProfile: targetRole === 'clinician' ? combineMedicalProfile(formData) : undefined
  });

  revalidatePath('/doctors');
  revalidatePath('/reviewers');
  revalidatePath('/auditors');
  revalidatePath('/admins');
  return { ok: true };
}
