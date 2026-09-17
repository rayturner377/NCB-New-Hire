import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { RouteTabs } from '../../../components/dashboard/route-tabs';
import { SectionCard } from '../../../components/dashboard/section-card';
import { Button } from '../../../components/ui/button';
import { PERMISSIONS, canManageUserAccount, hasPermission } from '../../../lib/permissions';
import { parsePageNumber } from '../../../lib/pagination';
import { getSession } from '../../../lib/session';
import { MedicalOfficesTable } from '../../medical-offices/components/medical-offices-table';
import { listAllMedicalOffices } from '../../medical-offices/services/medical-offices-service';
import { RoleUserListSection } from '../components/role-user-list-section';
import { loadRoleUserPage } from './load-role-user-page';

export interface DoctorsWorkspaceContainerProps {
  /** `?tab=offices` lands directly on Medical facilities — used by the sidebar link and the facility create/cancel flow. Defaults to `doctors`. */
  searchParams?: { tab?: string; query?: string; page?: string };
}

/**
 * Doctors and the medical facilities they're assigned to are two views onto
 * the same real-world thing — a doctor's office — so this is one page with
 * two tabs (like /cases' Review queue / All cases split) rather than two
 * separate sidebar destinations. Each tab is its own route (`?tab=doctors` /
 * `?tab=offices`, see RouteTabs) rather than a client-side toggle — only the
 * active tab's own data gets fetched. Each tab is also gated on its own permission
 * (DOCTORS_LIST / MEDICAL_OFFICES_LIST) independently — a viewer who only
 * holds one still gets a usable page instead of a hard redirect, they just
 * see one tab instead of two.
 */
export async function DoctorsWorkspaceContainer({ searchParams = {} }: DoctorsWorkspaceContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const canViewDoctors = hasPermission(session.user, PERMISSIONS.DOCTORS_LIST);
  const canViewOffices = hasPermission(session.user, PERMISSIONS.MEDICAL_OFFICES_LIST);
  if (!canViewDoctors && !canViewOffices) {
    redirect('/');
  }

  const showBothTabs = canViewDoctors && canViewOffices;
  const activeTab = showBothTabs && searchParams.tab === 'offices' ? 'offices' : canViewDoctors ? 'doctors' : 'offices';

  // Same policy createUserAction itself enforces (see role-users-container.tsx's own comment) —
  // a reviewer (STAFF_ACCOUNTS_MANAGE) sees this exactly where the action would actually let them
  // create a doctor account.
  const canCreateDoctor = canManageUserAccount(session.user, 'clinician');
  const canCreateOffice = hasPermission(session.user, PERMISSIONS.MEDICAL_OFFICES_CREATE);

  // Only the Offices tab needs the facility list now — the Doctors tab's own facility picker moved
  // to /doctors/[id]/edit (edit-role-user-container.tsx fetches its own copy) once Edit became a
  // dedicated page instead of a dialog embedded in this one. listAllMedicalOffices() (not
  // listActiveMedicalOffices()) so a deactivated facility stays visible/manageable here instead of
  // vanishing the moment it's turned off — that picker is the one place that should only ever offer
  // active facilities, not this admin table.
  const offices = activeTab === 'offices' && canViewOffices ? await listAllMedicalOffices() : [];

  let content: ReactNode;
  if (activeTab === 'doctors') {
    const query = searchParams.query?.trim() ?? '';
    const requestedPage = parsePageNumber(searchParams.page);

    function buildHref({ query: nextQuery, page }: { query: string; page: number }): string {
      const params = new URLSearchParams({ tab: 'doctors' });
      if (nextQuery) params.set('query', nextQuery);
      if (page > 1) params.set('page', String(page));
      return `/doctors?${params.toString()}`;
    }

    const { stats, users: doctors, totalPages, caseCounts } = await loadRoleUserPage('clinician', { query, requestedPage }, buildHref);

    content = (
      <RoleUserListSection
        title="All doctors"
        roleLabel="Doctors"
        roleLabelSingular="doctor"
        newHref="/doctors/new"
        canCreate={canCreateDoctor}
        currentUserId={session.user.id}
        stats={stats}
        users={doctors}
        caseCounts={caseCounts}
        query={query}
        page={requestedPage}
        totalPages={totalPages}
        basePath="/doctors"
        fixedParams={{ tab: 'doctors' }}
      />
    );
  } else {
    content = (
      <div className="flex flex-col gap-6">
        {canCreateOffice ? (
          <div className="flex justify-end">
            <Button variant="link" size="sm" className="h-auto p-0" asChild>
              <Link href="/medical-offices/new">
                <Plus className="mr-1.5 h-4 w-4" /> New facility
              </Link>
            </Button>
          </div>
        ) : null}

        <SectionCard title="Medical facilities" description="Doctors are assigned to one of these when their account is created.">
          <MedicalOfficesTable offices={offices} />
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {showBothTabs ? (
        <RouteTabs
          activeKey={activeTab}
          tabs={[
            { key: 'doctors', label: 'Doctors', href: '/doctors?tab=doctors' },
            { key: 'offices', label: 'Medical facilities', href: '/doctors?tab=offices' }
          ]}
        />
      ) : null}
      {content}
    </div>
  );
}
