'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auditRepository, rolePermissionsRepository } from '@ncb/database';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { invalidateRolePermissionsCache } from '../../../lib/effective-permissions';
import { ASSIGNABLE_PERMISSIONS, ForbiddenError, PERMISSIONS, ROLES, requirePermission } from '../../../lib/permissions';
import { requireFullSession } from '../../../lib/session';
import type { SettingsActionResult } from '../types-action';

const EDITABLE_ROLES = new Set<string>([ROLES.REVIEWER, ROLES.AUDITOR, ROLES.DOCTOR, ROLES.DELEGATE, ROLES.PATIENT]);
// Not Object.values(PERMISSIONS) — USERS_MANAGE/SETTINGS_MANAGE/ROLES_MANAGE must never be
// assignable to a non-admin role through this action; see ASSIGNABLE_PERMISSIONS's own doc comment.
const VALID_PERMISSIONS = new Set<string>(ASSIGNABLE_PERMISSIONS);

const updateRolePermissionsSchema = z.object({
  role: z.string().refine((value) => EDITABLE_ROLES.has(value), 'admin is not editable — it always holds every permission'),
  permissions: z.array(z.string().refine((value) => VALID_PERMISSIONS.has(value), 'Unknown permission'))
});

/** Settings -> Permissions' "Save" per role — replaces that role's whole grant set (see rolePermissionsRepository.setForRole). Admin-only (ROLES_MANAGE), and 'admin' itself is refused as a target so it can never be edited into losing full access. */
export async function updateRolePermissionsAction(
  _prevState: SettingsActionResult | null,
  formData: FormData
): Promise<SettingsActionResult> {
  await assertSameOrigin();

  const session = await requireFullSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    requirePermission(session.user, PERMISSIONS.ROLES_MANAGE);
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, error: error.message };
    throw error;
  }

  const parsed = updateRolePermissionsSchema.safeParse({
    role: formData.get('role'),
    permissions: formData.getAll('permissions')
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid role permissions.' };
  }

  await rolePermissionsRepository.setForRole(parsed.data.role, parsed.data.permissions);
  await invalidateRolePermissionsCache();

  await auditRepository.append({
    eventType: 'role_permissions_updated',
    actorUserId: session.user.id,
    entityType: 'role',
    entityId: parsed.data.role,
    details: { permissions: parsed.data.permissions }
  });

  revalidatePath('/settings');
  return { ok: true };
}
