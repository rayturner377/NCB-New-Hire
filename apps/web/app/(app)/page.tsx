import { redirect } from 'next/navigation';
import { AdminDashboard } from '../../features/dashboard/components/admin/admin-dashboard';
import { ReviewerDashboard } from '../../features/dashboard/components/reviewer/reviewer-dashboard';
import { DoctorDashboardContainer } from '../../features/dashboard/containers/doctor/doctor-dashboard-container';
import { PatientDashboardContainer } from '../../features/dashboard/containers/patient/patient-dashboard-container';
import { ROLES } from '../../lib/permissions';
import { getSession } from '../../lib/session';

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 30);
  const toIso = (date: Date) => date.toISOString().slice(0, 10);
  return { from: toIso(from), to: toIso(to) };
}

/** Role-based landing page — every role's dashboard is wired to real data (doctor/patient services, reviewer-dashboard-service.ts for reviewer/admin/auditor). */
export default async function DashboardPage(
  props: {
    searchParams: Promise<{ from?: string; to?: string; status?: string; page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const defaults = defaultDateRange();
  const from = searchParams.from || defaults.from;
  const to = searchParams.to || defaults.to;

  return <div className="p-6">{dashboardForRole(session.user, from, to, searchParams)}</div>;
}

function dashboardForRole(
  user: { role: string; id: string; delegateForClinicianId?: string | null },
  from: string,
  to: string,
  searchParams: { from?: string; to?: string; status?: string; page?: string }
) {
  switch (user.role) {
    case ROLES.DOCTOR:
      return <DoctorDashboardContainer clinicianId={user.id} basePath="/" searchParams={searchParams} />;
    // A delegate's dashboard is the exact same container/query as their doctor's own, just scoped
    // to the doctor they're linked to instead of their own id — see matchesClinicianAssignment()'s matching branch.
    // No doctor linked yet resolves to an impossible clinicianId, so listForClinician legitimately
    // returns nothing rather than the container needing its own "no doctor assigned" empty state.
    case ROLES.DELEGATE:
      return <DoctorDashboardContainer clinicianId={user.delegateForClinicianId ?? 'no-doctor-linked'} basePath="/" searchParams={searchParams} />;
    case ROLES.PATIENT:
      return <PatientDashboardContainer userId={user.id} />;
    case ROLES.REVIEWER:
    case ROLES.AUDITOR:
      return <ReviewerDashboard from={from} to={to} />;
    case ROLES.ADMIN:
      return <AdminDashboard from={from} to={to} />;
    default:
      return null;
  }
}
