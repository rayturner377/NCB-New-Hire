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
export default async function DashboardPage({
  searchParams
}: {
  searchParams: { from?: string; to?: string; status?: string; page?: string };
}) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const defaults = defaultDateRange();
  const from = searchParams.from || defaults.from;
  const to = searchParams.to || defaults.to;

  return <div className="p-6">{dashboardForRole(session.user.role, session.user.id, from, to, searchParams)}</div>;
}

function dashboardForRole(
  role: string,
  userId: string,
  from: string,
  to: string,
  searchParams: { from?: string; to?: string; status?: string; page?: string }
) {
  switch (role) {
    case ROLES.DOCTOR:
      return <DoctorDashboardContainer clinicianId={userId} basePath="/" searchParams={searchParams} />;
    case ROLES.PATIENT:
      return <PatientDashboardContainer userId={userId} />;
    case ROLES.REVIEWER:
    case ROLES.AUDITOR:
      return <ReviewerDashboard from={from} to={to} />;
    case ROLES.ADMIN:
      return <AdminDashboard from={from} to={to} />;
    default:
      return null;
  }
}
