import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SectionCard } from '../../../components/dashboard/section-card';
import { Button } from '../../../components/ui/button';
import { countCasesForClinicians } from '../../cases/services/cases-service';
import { canManageUserAccount, hasPermission, type Permission } from '../../../lib/permissions';
import { parsePageNumber } from '../../../lib/pagination';
import { getSession } from '../../../lib/session';
import { LIST_PATH_BY_ROLE } from '../../../lib/role-list-paths';
import { UserStats } from '../components/user-stats';
import { UsersTable } from '../components/users-table';
import { getUserRoleStats, searchUsers } from '../services/users-service';

const PAGE_SIZE = 8;

export interface RoleUsersContainerProps {
  /** The AppUser.role value this page scopes down to. */
  role: string;
  /** Plural, e.g. "Doctors". */
  roleLabel: string;
  /** Singular, lowercase, e.g. "doctor" — for the "+ New doctor" link. */
  roleLabelSingular: string;
  listPermission: Permission;
  newHref: string;
  searchParams?: { query?: string; page?: string };
}

/**
 * One container reused for /reviewers, /admins, /auditors, and /delegates —
 * same stats+table shell as CandidatesContainer, parameterized by role
 * instead of near-identical copies. Both the stats and the table query only
 * this role's own accounts, paginated/searched server-side (searchUsers/
 * getUserRoleStats) rather than fetching every account in the system.
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
export async function RoleUsersContainer({ role, roleLabel, roleLabelSingular, listPermission, newHref, searchParams = {} }: RoleUsersContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!hasPermission(session.user, listPermission)) {
    redirect('/');
  }

  const canCreate = canManageUserAccount(session.user, role);
  const query = searchParams.query?.trim() ?? '';
  const requestedPage = parsePageNumber(searchParams.page);

  const basePath = LIST_PATH_BY_ROLE[role] ?? newHref.replace(/\/new$/, '');
  function buildHref({ query: nextQuery, page }: { query: string; page: number }): string {
    const params = new URLSearchParams();
    if (nextQuery) params.set('query', nextQuery);
    if (page > 1) params.set('page', String(page));
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  }

  const [stats, { rows: users, total }] = await Promise.all([
    getUserRoleStats(role),
    searchUsers({ role, query }, requestedPage, PAGE_SIZE)
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Corrects the URL itself rather than showing 0 rows from the out-of-range page under a
  // "Page N of M" label that implies real rows exist there.
  if (requestedPage > totalPages) {
    redirect(buildHref({ query, page: totalPages }));
  }

  const caseCounts = role === 'clinician' ? await countCasesForClinicians(users.map((user) => user.id)) : undefined;

  return (
    <div className="flex flex-col gap-6 p-6">
      <UserStats total={stats.total} active={stats.active} label={roleLabel} />

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
          canManage={canCreate}
          query={query}
          page={requestedPage}
          totalPages={totalPages}
          buildHref={buildHref}
        />
      </SectionCard>
    </div>
  );
}
