'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, ROLES, requireCanManageUserAccount } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { getUserRole, isOwnDelegate, setUserActive } from '../services/users-service';

/**
 * No-JS-required toggle — the row's activate/deactivate button posts its
 * target user id and desired state. Two ways to be authorized for this:
 * requireCanManageUserAccount (admin/reviewer, same gate as creating/
 * deleting an account — never against an admin target), or a doctor acting
 * on the one delegate account linked to them (isOwnDelegate) — a narrower,
 * separate authority that only ever covers activate/deactivate, never
 * create/edit-role/delete/reassign.
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

  if (session.user.role === ROLES.DOCTOR) {
    if (!(await isOwnDelegate(session.user.id, userId))) return;
  } else {
    try {
      requireCanManageUserAccount(session.user, targetRole);
    } catch (error) {
      if (error instanceof ForbiddenError) return;
      throw error;
    }
  }

  await setUserActive(userId, active, session.user.id);
  revalidatePath('/doctors');
  revalidatePath('/reviewers');
  revalidatePath('/auditors');
  revalidatePath('/admins');
  revalidatePath('/delegates');
}
