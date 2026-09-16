import { redirect } from 'next/navigation';
import { canManageUserAccount, type Role } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { listActiveMedicalOfficeOptions } from '../../medical-offices/services/medical-offices-service';
import { UserForm } from '../components/user-form';
import { listActiveDoctors } from '../services/users-service';

export interface NewRoleUserContainerProps {
  role: Role;
  roleLabel: string;
  /** Where "Cancel" (and a rejected-permission visit) sends the admin — the role's own list page. */
  cancelHref: string;
}

/**
 * Reused for /doctors/new, /reviewers/new, and /admins/new — mirrors
 * NewCandidateContainer. Gated by canManageUserAccount(actor, role), the same
 * policy createUserAction itself enforces — see role-users-container.tsx's
 * own comment on why this needs no separate permission prop.
 */
export async function NewRoleUserContainer({ role, roleLabel, cancelHref }: NewRoleUserContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!canManageUserAccount(session.user, role)) {
    redirect(cancelHref);
  }

  const offices = role === 'clinician' ? await listActiveMedicalOfficeOptions() : [];
  const doctors = role === 'delegate' ? await listActiveDoctors() : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">New {roleLabel.toLowerCase()}</h1>
        <p className="text-sm text-muted-foreground">
          Create a {roleLabel.toLowerCase()} account — they&apos;ll receive an activation code by email to set their own password.
        </p>
      </div>
      <UserForm role={role} roleLabel={roleLabel} cancelHref={cancelHref} offices={offices} doctors={doctors} />
    </div>
  );
}
