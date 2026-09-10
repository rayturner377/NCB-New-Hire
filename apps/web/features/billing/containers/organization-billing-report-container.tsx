import { redirect } from 'next/navigation';
import { logAccessDenied } from '../../../lib/audit-access';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { containingFinancialYear, currentFinancialYearLabel, financialYearBounds } from '../financial-year';
import { getOrganizationBillingReport } from '../services/billing-report-service';
import { formatBillingRangeLabel } from './billing-report-container';
import { OrganizationBillingReport } from '../components/organization-billing-report';

export interface OrganizationBillingReportContainerProps {
  searchParams?: { clinicianId?: string; billing?: string; from?: string; to?: string; query?: string; fy?: string; page?: string };
}

const PAGE_SIZE = 10;
const ALL_TIME = 'all';

/**
 * There's exactly one source of truth here — the actual `from`/`to` dates —
 * and the FY dropdown's displayed value is *derived* from them, not tracked
 * as separate state:
 * - Nothing in the URL at all → defaults to the current financial year.
 * - `fy=all` with no dates → true all-time, no bound at either end.
 * - Any `from`/`to` present → used as-is; the dropdown then shows whichever
 *   FY fully contains that range (see containingFinancialYear), or "All" if
 *   it doesn't cleanly fit inside one (spans a boundary, or is open-ended).
 *
 * This is what makes "pick FY26, then narrow to just August" keep showing
 * FY26 in the dropdown, while "pick FY26, then drag the end date into
 * FY27" correctly flips the dropdown to "All" — both fall out of the same
 * containment check rather than needing separate rules for each gesture.
 */
function resolveDateRange(fyIsAll: boolean, fromParam: string, toParam: string): { from: string; to: string; dropdownFy: string } {
  if (fyIsAll && !fromParam && !toParam) {
    return { from: '', to: '', dropdownFy: ALL_TIME };
  }

  let from = fromParam;
  let to = toParam;
  if (!from && !to) {
    const currentBounds = financialYearBounds(currentFinancialYearLabel())!;
    from = currentBounds.from;
    to = currentBounds.to;
  }

  return { from, to, dropdownFy: containingFinancialYear(from, to) ?? ALL_TIME };
}

/** The stat cards show a concrete date span whenever one is active — "FY26" only stands in for it when the range is exactly that FY's own Oct 1–Sep 30 bounds, not a narrower slice someone picked inside it. */
function formatRangeLabel(dropdownFy: string, from: string, to: string): string {
  if (!from && !to) return 'all time';
  if (dropdownFy !== ALL_TIME) {
    const bounds = financialYearBounds(dropdownFy);
    if (bounds && bounds.from === from && bounds.to === to) return dropdownFy;
  }
  return formatBillingRangeLabel(from, to);
}

/** The admin/reviewer/auditor view at /billing — see app/(app)/billing/page.tsx's role dispatch, and BillingReportContainer for the doctor's own equivalent. */
export async function OrganizationBillingReportContainer({ searchParams = {} }: OrganizationBillingReportContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (!hasPermission(session.user, PERMISSIONS.REPORTS_VIEW)) {
    await logAccessDenied({
      userId: session.user.id,
      role: session.user.role,
      permission: PERMISSIONS.REPORTS_VIEW,
      path: '/billing'
    });
    redirect('/');
  }

  const clinicianId = searchParams.clinicianId ?? '';
  const billing = searchParams.billing ?? '';
  const query = searchParams.query ?? '';
  const fromParam = searchParams.from ?? '';
  const toParam = searchParams.to ?? '';
  const hasActiveFilters = Boolean(clinicianId || billing || query || searchParams.fy || fromParam || toParam);

  const { from, to, dropdownFy } = resolveDateRange(searchParams.fy === ALL_TIME, fromParam, toParam);

  const data = await getOrganizationBillingReport({ clinicianId, billing, from, to, query });
  const selectedDoctorName = clinicianId ? data.doctors.find((doctor) => doctor.id === clinicianId)?.displayName ?? 'This doctor' : undefined;

  const rows = data.rows ?? [];
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, Number(searchParams.page) || 1), totalPages);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function hrefForPage(page: number): string {
    const params = new URLSearchParams();
    if (clinicianId) params.set('clinicianId', clinicianId);
    if (billing) params.set('billing', billing);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    // Neither bound set means the user explicitly chose "All time" (resolveDateRange only ever
    // produces this from that literal fy=all + no dates case) — carry the sentinel forward so
    // paging doesn't silently fall back to the current-FY default.
    if (!from && !to) params.set('fy', ALL_TIME);
    if (query) params.set('query', query);
    if (page > 1) params.set('page', String(page));
    const search = params.toString();
    return search ? `/billing?${search}` : '/billing';
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <OrganizationBillingReport
        data={data}
        pageRows={pageRows}
        selectedDoctorName={selectedDoctorName}
        filters={{ clinicianId, query, billing, fy: dropdownFy, from, to }}
        hasActiveFilters={hasActiveFilters}
        rangeLabel={formatRangeLabel(dropdownFy, from, to)}
        pagination={{ page: currentPage, totalPages, hrefForPage }}
      />
    </div>
  );
}
