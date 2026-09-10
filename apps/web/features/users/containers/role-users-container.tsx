import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SectionCard } from '../../../components/dashboard/section-card';
import { Button } from '../../../components/ui/button';
import { countCasesForClinician } from '../../cases/services/cases-service';
import { PERMISSIONS, canManageUserAccount, hasPermission, permissionCatalog, type Permission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { listActiveMedicalOffices } from '../../medical-offices/services/medical-offices-service';
import { UserStats } from '../components/user-stats';
import { UsersTable } from '../components/users-table';
import { listUsers } from '../services/users-service';

export interface RoleUsersContainerProps {
  /** The AppUser.role value this page scopes down to. */
  role: string;
  /** Plural, e.g. "Doctors". */
  roleLabel: string;
  /** Singular, lowercase, e.g. "doctor" — for the "+ New doctor" link. */
  roleLabelSingular: string;
  listPermission: Permission;
  newHref: string;
}

/**
 * One container reused for /doctors, /reviewers, and /admins — same
 * stats+table shell as CandidatesContainer, parameterized by role instead of
 * three near-identical copies. Unlike Candidates (still wireframed against
 * mock data), this is wired to the real listUsers() service throughout.
 *
 * Whether "New <role>" shows is decided by canManageUserAccount(actor, role)
 * rather than a separate createPermission prop — the same policy used by
 * create/update/delete/set-active (see features/users/actions), so a
 * reviewer sees the button here exactly where those actions would actually
 * let them proceed, with no second permission list to keep in sync. For
 * role="admin" this naturally requires USERS_MANAGE, since
 * canManageUserAccount never grants STAFF_ACCOUNTS_MANAGE against an admin
 * target — no special-casing needed for /admins specifically. The same
 * boolean also gates UsersTable's Edit/Deactivate/Delete controls (its own
 * `canManage` prop) — "can create this role" and "can manage an existing
 * account of this role" are the identical policy question for the same
 * target role, so there's one canManageUserAccount call per render, not two.
 */
export async function RoleUsersContainer({ role, roleLabel, roleLabelSingular, listPermission, newHref }: RoleUsersContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!hasPermission(session.user, listPermission)) {
    redirect('/');
  }

  const canCreate = canManageUserAccount(session.user, role);
  const allPermissions = hasPermission(session.user, PERMISSIONS.ROLES_MANAGE) ? permissionCatalog() : undefined;
  const users = (await listUsers()).filter((user) => user.role === role);

  let caseCounts: Record<string, { total: number; active: number }> | undefined;
  let offices: Awaited<ReturnType<typeof listActiveMedicalOffices>> | undefined;
  if (role === 'clinician') {
    const entries = await Promise.all(users.map(async (user) => [user.id, await countCasesForClinician(user.id)] as const));
    caseCounts = Object.fromEntries(entries);
    offices = await listActiveMedicalOffices();
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <UserStats users={users} label={roleLabel} />

      {canCreate ? (
        <div className="flex justify-end">
          <Button variant="link" size="sm" className="h-auto p-0" asChild>
            <Link href={newHref}>
              <Plus className="mr-1.5 h-4 w-4" /> New {roleLabelSingular}
            </Link>
          </Button>
        </div>
      ) : null}

      <SectionCard title={`All ${roleLabel.toLowerCase()}`}>
        <UsersTable
          users={users}
          currentUserId={session.user.id}
          caseCounts={caseCounts}
          offices={offices}
          canManage={canCreate}
          allPermissions={allPermissions}
        />
      </SectionCard>
    </div>
  );
}
