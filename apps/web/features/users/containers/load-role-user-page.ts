import { redirect } from 'next/navigation';
import { countCasesForClinicians } from '../../cases/services/cases-service';
import { getUserRoleStats, searchUsers } from '../services/users-service';
import type { UserSummary } from '../types';

const PAGE_SIZE = 8;

export interface RoleUserPageFilters {
  query: string;
  requestedPage: number;
}

export interface RoleUserPage {
  stats: { total: number; active: number };
  users: UserSummary[];
  totalPages: number;
  /** Doctors only — see countCasesForClinicians. Omitted entirely for every other role. */
  caseCounts?: Record<string, { total: number; active: number }>;
}

/**
 * Shared by role-users-container.tsx (/reviewers, /admins, /auditors, /delegates) and
 * doctors-workspace-container.tsx's Doctors tab — both pages fetch this role's stats, search/
 * paginate its accounts server-side, redirect off an out-of-range page, and (doctors only) batch
 * their case counts. `buildHref` is supplied by the caller since each page's URL shape differs
 * (a bare `/reviewers?query=...` vs. `/doctors?tab=doctors&query=...`).
 */
export async function loadRoleUserPage(
  role: string,
  { query, requestedPage }: RoleUserPageFilters,
  buildHref: (next: { query: string; page: number }) => string
): Promise<RoleUserPage> {
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

  return { stats, users, totalPages, caseCounts };
}
