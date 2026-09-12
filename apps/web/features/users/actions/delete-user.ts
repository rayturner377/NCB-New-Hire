'use server';

import { revalidatePath } from 'next/cache';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ForbiddenError, requireCanManageUserAccount } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import { deleteUser, getUserRole } from '../services/users-service';

/** Soft-deletes a staff/patient account — same gate as creating one (requireCanManageUserAccount), so a reviewer can delete a doctor/reviewer/auditor account but never an admin's. Can't delete yourself, regardless of role. */
export async function deleteUserAction(formData: FormData): Promise<void> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) return;

  const userId = String(formData.get('userId') || '');
  if (!userId || userId === session.user.id) return;

  // The target's role must come from the database, never the client — deciding permission from a
  // trusted-but-unverified value would let a reviewer just lie about who they're deleting.
  const targetRole = await getUserRole(userId);
  if (!targetRole) return;

  try {
    requireCanManageUserAccount(session.user, targetRole);
  } catch (error) {
    if (error instanceof ForbiddenError) return;
    throw error;
  }

  await deleteUser(userId, session.user.id);
  revalidatePath('/doctors');
  revalidatePath('/reviewers');
  revalidatePath('/auditors');
  revalidatePath('/admins');
}
