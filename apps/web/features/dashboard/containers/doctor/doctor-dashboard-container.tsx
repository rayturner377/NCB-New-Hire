import { getDoctorDashboardData } from '../../services/doctor/doctor-dashboard-service';
import { DoctorDashboard } from '../../components/doctor/doctor-dashboard';

export interface DoctorDashboardContainerProps {
  clinicianId: string;
  /** Where this dashboard actually lives — '/' for a doctor viewing their own, '/doctors/<id>' for an admin viewing someone else's (see features/users/containers/doctor-overview-container.tsx). Filter/pagination links build off this. */
  basePath?: string;
  /**
   * A doctor viewing their own dashboard sees the live inbox only — case
   * history/billing now lives on its own page (see /billing), so repeating
   * it here too was redundant. An admin looking at a specific doctor still
   * gets the full history section, since /billing is that doctor's own view
   * and isn't (yet) something an admin can open for someone else.
   */
  isOwnDashboard?: boolean;
  searchParams?: { status?: string; from?: string; to?: string; page?: string };
}

const PAGE_SIZE = 10;

export async function DoctorDashboardContainer({
  clinicianId,
  basePath = '/',
  isOwnDashboard = true,
  searchParams = {}
}: DoctorDashboardContainerProps) {
  const status = searchParams.status ?? '';
  const from = searchParams.from ?? '';
  const to = searchParams.to ?? '';
  const hasActiveFilters = Boolean(status || from || to);

  const data = await getDoctorDashboardData(clinicianId, { status, from, to });

  if (isOwnDashboard) {
    return <DoctorDashboard data={data} showHistory={false} />;
  }

  const totalPages = Math.max(1, Math.ceil(data.history.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(searchParams.page) || 1), totalPages);
  const historyPageRows = data.history.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function hrefForPage(page: number): string {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (page > 1) params.set('page', String(page));
    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  }

  return (
    <DoctorDashboard
      data={data}
      showHistory
      historyPageRows={historyPageRows}
      basePath={basePath}
      filters={{ status, from, to }}
      hasActiveFilters={hasActiveFilters}
      pagination={{ page: currentPage, totalPages, hrefForPage }}
    />
  );
}
