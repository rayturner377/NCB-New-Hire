'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auditRepository } from '@ncb/database';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { ASSIGNABLE_PERMISSIONS, ForbiddenError, PERMISSIONS, ROLES, requirePermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { getUserRole, updateUser } from '../services/users-service';
import type { SettingsActionResult } from '../../settings/types-action';

// Not Object.values(PERMISSIONS) — see ASSIGNABLE_PERMISSIONS's own doc comment. A per-user grant
// of USERS_MANAGE/SETTINGS_MANAGE would be an even more targeted way to defeat the admin/reviewer
// boundary than a whole-role grant would be.
const VALID_PERMISSIONS = new Set<string>(ASSIGNABLE_PERMISSIONS);
const permissionList = z.array(z.string().refine((value) => VALID_PERMISSIONS.has(value), 'Unknown permission'));

const schema = z.object({
  userId: z.string().min(1),
  grant: permissionList,
  revoke: permissionList
});

/**
 * Per-user exceptions on top of a role's own grant (Settings/user detail's "Extra permissions") —
 * e.g. one HR reviewer who also needs a permission the rest of the reviewer role doesn't have,
 * without inventing a whole new role for one person. Deliberately gated on ROLES_MANAGE
 * (admin-only), stricter than the STAFF_ACCOUNTS_MANAGE reviewers otherwise hold for account
 * CRUD — letting a reviewer grant arbitrary permissions to another account would be a much bigger
 * hole than anything canManageUserAccount's "except admins" carve-out was built to prevent.
 * Refuses an admin target outright: getEffectivePermissions never reads overrides for that role
 * anyway (admin always holds everything), so there's nothing a saved override there could
 * meaningfully do except confuse the UI.
 */
export async function updateUserPermissionOverridesAction(
  _prevState: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  await assertSameOrigin();

  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.ROLES_MANAGE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  const parsed = schema.safeParse({
    userId: formData.get('userId'),
    grant: formData.getAll('grant'),
    revoke: formData.getAll('revoke')
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid permission overrides.' };
  }

  const targetRole = await getUserRole(parsed.data.userId);
  if (!targetRole) {
    return { ok: false, error: 'User not found.' };
  }
  if (targetRole === ROLES.ADMIN) {
    return { ok: false, error: 'Admin accounts already hold every permission — overrides have no effect on them.' };
  }

  // Revoke wins over grant (see getEffectivePermissions) — dropping any permission from both
  // lists that somehow ended up in each keeps the stored data unambiguous, not just the read side.
  const revokeSet = new Set(parsed.data.revoke);
  const grant = parsed.data.grant.filter((permission) => !revokeSet.has(permission));

  await updateUser(parsed.data.userId, { permissionOverrides: { grant, revoke: parsed.data.revoke } });

  await auditRepository.append({
    eventType: 'user_permission_overrides_updated',
    actorUserId: session.user.id,
    entityType: 'user',
    entityId: parsed.data.userId,
    details: { grant, revoke: parsed.data.revoke }
  });

  revalidatePath('/doctors');
  revalidatePath('/reviewers');
  revalidatePath('/auditors');
  return { ok: true };
}
