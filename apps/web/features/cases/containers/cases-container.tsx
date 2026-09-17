import { Plus } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RouteTabs } from '../../../components/dashboard/route-tabs';
import { SectionCard } from '../../../components/dashboard/section-card';
import { Pagination } from '../../../components/dashboard/pagination';
import { Button } from '../../../components/ui/button';
import { logAccessDenied } from '../../../lib/audit-access';
import { PERMISSIONS, hasPermission } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { getSettings } from '../../settings/services/settings-service';
import { parsePageNumber } from '../../../lib/pagination';
import { CaseList } from '../components/case-list';
import { CasesFilters } from '../components/cases-filters';
import { parseBillingFilter } from '../billing-status';
import { listReviewQueueCases, searchCasesWithPatient } from '../services/cases-service';

export interface CasesContainerProps {
  searchParams?: {
    tab?: string;
    query?: string;
    status?: string;
    billing?: string;
    from?: string;
    to?: string;
    page?: string;
  };
}

const PAGE_SIZE = 10;

/**
 * The review queue isn't a separate destination anymore — it's a tab on this
 * same page (see cases-service.ts's listReviewQueueCases for its membership
 * rule), since it's really just "cases" narrowed to one fixed question with
 * no filters of its own. Each tab is its own route (`?tab=review` /
 * `?tab=all`, see RouteTabs) rather than a client-side toggle, so only the
 * active tab's own data gets queried — landing on Review queue never also
 * runs the full, filterable All-cases query, and vice versa.
 */
export async function CasesContainer({ searchParams = {} }: CasesContainerProps) {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  // MEDICAL_CASES_LIST also covers a patient's own dashboard and a doctor's (or
  // their delegate's) own case queue — this page is the reviewer/admin/auditor
  // "every case in the system" view, which none of those should reach even by
  // direct URL (a patient's own cases show on their dashboard; a doctor's or
  // delegate's on theirs, see doctor-dashboard-service.ts's history section —
  // both via /cases/[id] once ownership-checked there, not this unscoped
  // list). 'delegate' holds the exact same MEDICAL_CASES_LIST permission
  // 'clinician' does, so it needs the same exclusion here or it would see
  // every case in the system rather than just the ones assigned to the
  // doctor it supports.
  if (
    session.user.role === 'patient' ||
    session.user.role === 'clinician' ||
    session.user.role === 'delegate' ||
    !hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_LIST)
  ) {
    await logAccessDenied({
      userId: session.user.id,
      role: session.user.role,
      permission: PERMISSIONS.MEDICAL_CASES_LIST,
      path: '/cases'
    });
    redirect('/');
  }

  // Redirects the bare /cases the sidebar still links to onto its actual
  // default tab, so the address bar always names the tab actually showing
  // rather than leaving it implicit. Whichever tab has something to act on
  // opens first: Review queue if it's non-empty, otherwise All cases — a
  // reviewer with nothing waiting on them shouldn't land on a visibly empty
  // tab. This one-time existence check is the only place both tabs' data
  // gets touched in the same request; every other navigation (clicking a
  // tab, paging, filtering) already names its tab explicitly and only ever
  // queries that one.
  if (!searchParams.tab) {
    const queueCases = await listReviewQueueCases();
    redirect(queueCases.length > 0 ? '/cases?tab=review' : '/cases?tab=all');
  }

  const canCreate = hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_CREATE);
  const activeTab = searchParams.tab === 'all' ? 'all' : 'review';
  const { sla } = await getSettings();

  let content;
  if (activeTab === 'review') {
    const queueCases = await listReviewQueueCases();
    const sortedQueue = [...queueCases].sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
    const totalPages = Math.max(1, Math.ceil(sortedQueue.length / PAGE_SIZE));
    const requestedPage = parsePageNumber(searchParams.page);

    function hrefForReviewPage(page: number): string {
      return page > 1 ? `/cases?tab=review&page=${page}` : '/cases?tab=review';
    }

    // Corrects the URL itself rather than silently showing the last valid page under a
    // page-number label that no longer matches it (e.g. requesting page 999 of 3).
    if (requestedPage > totalPages) {
      redirect(hrefForReviewPage(totalPages));
    }

    const pageRows = sortedQueue.slice((requestedPage - 1) * PAGE_SIZE, requestedPage * PAGE_SIZE);

    content = (
      <SectionCard
        title="Review queue"
        description={`${sortedQueue.length} case${sortedQueue.length === 1 ? '' : 's'} awaiting HR review or payment, oldest first`}
      >
        <div className="flex flex-col gap-4">
          <CaseList cases={pageRows} slaDefinitions={sla.definitions} />
          <Pagination page={requestedPage} totalPages={totalPages} hrefForPage={hrefForReviewPage} />
        </div>
      </SectionCard>
    );
  } else {
    const query = searchParams.query?.trim() ?? '';
    const status = searchParams.status ?? '';
    const billing = parseBillingFilter(searchParams.billing);
    const from = searchParams.from ?? '';
    const to = searchParams.to ?? '';
    const hasActiveFilters = Boolean(query || status || billing || from || to);

    const requestedPage = parsePageNumber(searchParams.page);
    const { rows: pageRows, total } = await searchCasesWithPatient({ query, status, billing, from, to }, requestedPage, PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    function hrefForPage(page: number): string {
      const params = new URLSearchParams({ tab: 'all' });
      if (query) params.set('query', query);
      if (status) params.set('status', status);
      if (billing) params.set('billing', billing);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (page > 1) params.set('page', String(page));
      return `/cases?${params.toString()}`;
    }

    // Corrects the URL itself (a real redirect, not just a relabeled page number) rather than
    // showing 0 rows from the out-of-range page under a "Page N of M" label that implies real
    // rows exist there.
    if (requestedPage > totalPages) {
      redirect(hrefForPage(totalPages));
    }

    content = (
      <SectionCard title="All cases" description={`${total} case${total === 1 ? '' : 's'}${hasActiveFilters ? ' matching these filters' : ''}`}>
        <div className="flex flex-col gap-4">
          <CasesFilters query={query} status={status} billing={billing} from={from} to={to} hasActiveFilters={hasActiveFilters} />
          <CaseList cases={pageRows} slaDefinitions={sla.definitions} />
          <Pagination page={requestedPage} totalPages={totalPages} hrefForPage={hrefForPage} />
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {canCreate ? (
        <div className="flex justify-end">
          <Button variant="link" size="sm" className="h-auto p-0" asChild>
            <Link href="/cases/new">
              <Plus className="mr-1.5 h-4 w-4" /> New case
            </Link>
          </Button>
        </div>
      ) : null}

      <RouteTabs
        activeKey={activeTab}
        tabs={[
          { key: 'review', label: 'Review queue', href: '/cases?tab=review' },
          { key: 'all', label: 'All cases', href: '/cases?tab=all' }
        ]}
      />

      {content}
    </div>
  );
}
