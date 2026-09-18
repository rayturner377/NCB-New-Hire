import { redirect } from 'next/navigation';
import { logAccessDenied } from '../../../lib/audit-access';
import { PERMISSIONS } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { getDoctorBillingReport } from '../services/billing-report-service';
import { BillingReport } from '../components/billing-report';

export interface BillingReportContainerProps {
  searchParams?: { billing?: string; from?: string; to?: string; query?: string; page?: string };
}

export function formatBillingRangeLabel(from: string, to: string): string {
  if (!from && !to) return 'all time';
  const format = (value: string) =>
    new Date(`${value}T00:00:00.000Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  if (from && to) return `${format(from)} – ${format(to)}`;
  if (from) return `since ${format(from)}`;
  return `through ${format(to)}`;
}

const PAGE_SIZE = 10;

/**
 * A doctor's own billing report — no separate permission constant, this is
 * identity-scoped (like the doctor dashboard) rather than a granular grant:
 * every clinician can see their own earnings, nobody can see anyone else's
 * through this route. See app/(app)/billing/page.tsx for the admin/reviewer
 * equivalent (OrganizationBillingReportContainer), dispatched by role.
 */
export async function BillingReportContainer({ searchParams = {} }: BillingReportContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (session.user.role !== 'clinician') {
    await logAccessDenied({
      userId: session.user.id,
      role: session.user.role,
      permission: PERMISSIONS.MEDICAL_CASES_LIST,
      path: '/billing'
    });
    redirect('/');
  }

  const billing = searchParams.billing ?? '';
  const from = searchParams.from ?? '';
  const to = searchParams.to ?? '';
  const query = searchParams.query ?? '';
  const hasActiveFilters = Boolean(billing || from || to || query);

  const data = await getDoctorBillingReport(session.user.id, { billing, from, to, query });

  const totalPages = Math.max(1, Math.ceil(data.rows.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(searchParams.page) || 1), totalPages);
  const pageRows = data.rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function hrefForPage(page: number): string {
    const params = new URLSearchParams();
    if (billing) params.set('billing', billing);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (query) params.set('query', query);
    if (page > 1) params.set('page', String(page));
    const search = params.toString();
    return search ? `/billing?${search}` : '/billing';
  }

  function buildExportHref(): string {
    const params = new URLSearchParams();
    if (billing) params.set('billing', billing);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (query) params.set('query', query);
    const search = params.toString();
    return search ? `/billing/export?${search}` : '/billing/export';
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <BillingReport
        data={data}
        pageRows={pageRows}
        filters={{ billing, from, to, query }}
        hasActiveFilters={hasActiveFilters}
        rangeLabel={formatBillingRangeLabel(from, to)}
        exportHref={buildExportHref()}
        pagination={{ page: currentPage, totalPages, hrefForPage }}
      />
    </div>
  );
}
