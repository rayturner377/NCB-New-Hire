import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { RouteTabs } from '../../../components/dashboard/route-tabs';
import { SectionCard } from '../../../components/dashboard/section-card';
import { Button } from '../../../components/ui/button';
import { PERMISSIONS, canManageUserAccount, hasPermission, permissionCatalog } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { MedicalOfficesTable } from '../../medical-offices/components/medical-offices-table';
import { listActiveMedicalOffices } from '../../medical-offices/services/medical-offices-service';
import { countCasesForClinician } from '../../cases/services/cases-service';
import { UserStats } from '../components/user-stats';
import { UsersTable } from '../components/users-table';
import { listUsers } from '../services/users-service';

export interface DoctorsWorkspaceContainerProps {
  /** `?tab=offices` lands directly on Medical facilities — used by the sidebar link and the facility create/cancel flow. Defaults to `doctors`. */
  searchParams?: { tab?: string };
}

/**
 * Doctors and the medical facilities they're assigned to are two views onto
 * the same real-world thing — a doctor's office — so this is one page with
 * two tabs (like /cases' Review queue / All cases split) rather than two
 * separate sidebar destinations. Each tab is its own route (`?tab=doctors` /
 * `?tab=offices`, see RouteTabs) rather than a client-side toggle — only the
 * active tab's own data gets fetched (offices are the exception: the Doctors
 * tab's own edit-doctor dialog needs the facility list too, so that one is
 * fetched either way). Each tab is also gated on its own permission
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
  const allPermissions = hasPermission(session.user, PERMISSIONS.ROLES_MANAGE) ? permissionCatalog() : undefined;
  const canCreateOffice = hasPermission(session.user, PERMISSIONS.MEDICAL_OFFICES_CREATE);

  // Offices are fetched whenever either tab needs them — the Doctors tab's own edit-doctor dialog
  // has a facility picker, so it isn't exclusively the Offices tab's data the way doctors/caseCounts
  // below are exclusively the Doctors tab's.
  const offices = canViewDoctors || canViewOffices ? await listActiveMedicalOffices() : [];

  let content: ReactNode;
  if (activeTab === 'doctors') {
    const doctors = (await listUsers()).filter((user) => user.role === 'clinician');
    const caseCountEntries = await Promise.all(
      doctors.map(async (doctor) => [doctor.id, await countCasesForClinician(doctor.id)] as const)
    );
    const caseCounts = Object.fromEntries(caseCountEntries);

    content = (
      <div className="flex flex-col gap-6">
        <UserStats users={doctors} label="Doctors" />

        {canCreateDoctor ? (
          <div className="flex justify-end">
            <Button variant="link" size="sm" className="h-auto p-0" asChild>
              <Link href="/doctors/new">
                <Plus className="mr-1.5 h-4 w-4" /> New doctor
              </Link>
            </Button>
          </div>
        ) : null}

        <SectionCard title="All doctors">
          <UsersTable
            users={doctors}
            currentUserId={session.user.id}
            caseCounts={caseCounts}
            offices={offices}
            canManage={canCreateDoctor}
            allPermissions={allPermissions}
          />
        </SectionCard>
      </div>
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
