import { redirect } from 'next/navigation';
import { logAccessDenied } from '../../../lib/audit-access';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { getCaseTurnaroundReport } from '../services/turnaround-report-service';
import { TurnaroundReport } from '../components/turnaround-report';

export interface TurnaroundReportContainerProps {
  searchParams?: { fromMilestone?: string; toMilestone?: string; from?: string; to?: string; query?: string; page?: string };
}

const PAGE_SIZE = 10;

function formatRangeLabel(from: string, to: string): string {
  if (!from && !to) return 'all time';
  const format = (value: string) =>
    new Date(`${value}T00:00:00.000Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  if (from && to) return `${format(from)} – ${format(to)}`;
  if (from) return `since ${format(from)}`;
  return `through ${format(to)}`;
}

function buildExportHref(filters: { fromMilestone: string; toMilestone: string; from: string; to: string; query: string }): string {
  const params = new URLSearchParams();
  params.set('fromMilestone', filters.fromMilestone);
  params.set('toMilestone', filters.toMilestone);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.query) params.set('query', filters.query);
  return `/reports/turnaround/export?${params.toString()}`;
}

/** Admin/reviewer/auditor only, same REPORTS_VIEW gate as the organization billing report — a doctor has no equivalent "my own" version of this report. */
export async function TurnaroundReportContainer({ searchParams = {} }: TurnaroundReportContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!hasPermission(session.user, PERMISSIONS.REPORTS_VIEW)) {
    await logAccessDenied({
      userId: session.user.id,
      role: session.user.role,
      permission: PERMISSIONS.REPORTS_VIEW,
      path: '/reports/turnaround'
    });
    redirect('/');
  }

  const from = searchParams.from ?? '';
  const to = searchParams.to ?? '';
  const query = searchParams.query ?? '';
  const hasActiveFilters = Boolean(from || to || query || searchParams.fromMilestone || searchParams.toMilestone);

  const data = await getCaseTurnaroundReport({ fromMilestone: searchParams.fromMilestone, toMilestone: searchParams.toMilestone, from, to, query });

  const totalPages = Math.max(1, Math.ceil(data.rows.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(searchParams.page) || 1), totalPages);
  const pageRows = data.rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function hrefForPage(page: number): string {
    const params = new URLSearchParams();
    params.set('fromMilestone', data.fromMilestone);
    params.set('toMilestone', data.toMilestone);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (query) params.set('query', query);
    if (page > 1) params.set('page', String(page));
    return `/reports/turnaround?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <TurnaroundReport
        data={data}
        pageRows={pageRows}
        filters={{ from, to, query }}
        hasActiveFilters={hasActiveFilters}
        rangeLabel={formatRangeLabel(from, to)}
        exportHref={buildExportHref({ fromMilestone: data.fromMilestone, toMilestone: data.toMilestone, from, to, query })}
        pagination={{ page: currentPage, totalPages, hrefForPage }}
      />
    </div>
  );
}
