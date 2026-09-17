import { Plus } from 'lucide-react';
import Link from 'next/link';
import { SectionCard } from '../../../components/dashboard/section-card';
import { Button } from '../../../components/ui/button';
import type { UserSummary } from '../types';
import { UserStats } from './user-stats';
import { UsersTable } from './users-table';

export interface RoleUserListSectionProps {
  /** SectionCard's heading, e.g. "All doctors" or "All reviewers". */
  title: string;
  /** Plural, e.g. "Doctors" — UserStats' own label. */
  roleLabel: string;
  /** Singular, lowercase, e.g. "doctor" — for the "+ New doctor" link. */
  roleLabelSingular: string;
  newHref: string;
  /** Gates both the "+ New <role>" link and UsersTable's Edit/Deactivate/Delete controls — see role-users-container.tsx's own comment on why this is one boolean, not two. */
  canCreate: boolean;
  currentUserId: string;
  stats: { total: number; active: number };
  users: UserSummary[];
  caseCounts?: Record<string, { total: number; active: number }>;
  query: string;
  page: number;
  totalPages: number;
  /** UsersTable's own basePath/fixedParams — see its doc comment for why these are plain data, not a buildHref function. */
  basePath: string;
  fixedParams?: Record<string, string>;
}

/**
 * The stats+create-link+table shell shared by role-users-container.tsx (/reviewers, /admins,
 * /auditors, /delegates) and doctors-workspace-container.tsx's Doctors tab. Each caller still owns
 * its own tab selection / permission gating; this only ever renders the list itself, from data its
 * caller already loaded (see load-role-user-page.ts's loadRoleUserPage).
 */
export function RoleUserListSection({
  title,
  roleLabel,
  roleLabelSingular,
  newHref,
  canCreate,
  currentUserId,
  stats,
  users,
  caseCounts,
  query,
  page,
  totalPages,
  basePath,
  fixedParams
}: RoleUserListSectionProps) {
  return (
    <div className="flex flex-col gap-6">
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

      <SectionCard title={title}>
        <UsersTable
          users={users}
          currentUserId={currentUserId}
          caseCounts={caseCounts}
          canManage={canCreate}
          query={query}
          page={page}
          totalPages={totalPages}
          basePath={basePath}
          fixedParams={fixedParams}
        />
      </SectionCard>
    </div>
  );
}
