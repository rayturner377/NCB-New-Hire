import { redirect } from 'next/navigation';
import { canManageUserAccount, hasPermission, permissionCatalog, PERMISSIONS } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { listActiveMedicalOfficeOptions } from '../../medical-offices/services/medical-offices-service';
import { EditUserForm } from '../components/edit-user-form';
import { getUserById, listActiveDoctors } from '../services/users-service';

export interface EditRoleUserContainerProps {
  userId: string;
  roleLabel: string;
  /** Where "Cancel" (and a rejected-permission visit) sends the admin — the role's own list page. */
  cancelHref: string;
}

/**
 * Reused for /doctors/[id]/edit, /reviewers/[id]/edit, /auditors/[id]/edit,
 * /admins/[id]/edit, and /delegates/[id]/edit — mirrors NewRoleUserContainer.
 * Replaces the old EditUserDialog modal (see edit-user-form.tsx's own doc
 * comment for why): a dedicated page instead of a dialog crammed into the
 * users table row.
 */
export async function EditRoleUserContainer({ userId, roleLabel, cancelHref }: EditRoleUserContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const user = await getUserById(userId);
  if (!user || !canManageUserAccount(session.user, user.role)) {
    redirect(cancelHref);
  }

  const offices = user.role === 'clinician' ? await listActiveMedicalOfficeOptions() : [];
  const doctors = user.role === 'delegate' ? await listActiveDoctors() : [];
  const allPermissions = hasPermission(session.user, PERMISSIONS.ROLES_MANAGE) ? permissionCatalog() : undefined;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Edit {user.displayName}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>
      <EditUserForm user={user} roleLabel={roleLabel} cancelHref={cancelHref} offices={offices} doctors={doctors} allPermissions={allPermissions} />
    </div>
  );
}
