'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, requireCanManageUserAccount } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { getUserRole, setUserActive } from '../services/users-service';

/**
 * No-JS-required toggle — the row's activate/deactivate button posts its
 * target user id and desired state. Same gate as creating/deleting an account
 * (requireCanManageUserAccount) — a reviewer can toggle a doctor/reviewer/
 * auditor account but never an admin's.
 */
export async function setUserActiveAction(formData: FormData): Promise<void> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) return;

  const userId = String(formData.get('userId') || '');
  const active = String(formData.get('active') || '') === 'true';
  if (!userId || userId === session.user.id) return;

  // The target's role must come from the database, never the client — see delete-user.ts's own
  // comment on the same lookup.
  const targetRole = await getUserRole(userId);
  if (!targetRole) return;

  try {
    requireCanManageUserAccount(session.user, targetRole);
  } catch (error) {
    if (error instanceof ForbiddenError) return;
    throw error;
  }

  await setUserActive(userId, active, session.user.id);
  revalidatePath('/doctors');
  revalidatePath('/reviewers');
  revalidatePath('/auditors');
  revalidatePath('/admins');
}
