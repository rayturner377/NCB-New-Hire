import { DollarSign } from 'lucide-react';
import Link from 'next/link';
import { StatCard } from '../../../../components/dashboard/stat-card';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { Pagination } from '../../../../components/dashboard/pagination';
import { Button } from '../../../../components/ui/button';
import type { DoctorCaseRow, DoctorDashboardData } from '../../services/doctor/doctor-dashboard-service';
import { DoctorCaseHistoryFilters } from './doctor-case-history-filters';
import { DoctorCaseTable } from './doctor-case-table';

export interface DoctorDashboardPagination {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
}

export type DoctorDashboardProps =
  | {
      data: DoctorDashboardData;
      /** The signed-in doctor's own dashboard — history/billing lives on /billing instead, so this just points there. */
      showHistory: false;
    }
  | {
      data: DoctorDashboardData;
      /** An admin looking at a specific doctor — still gets the full filterable history, since /billing is that doctor's own page. */
      showHistory: true;
      historyPageRows: DoctorCaseRow[];
      basePath: string;
      filters: { status: string; from: string; to: string };
      hasActiveFilters: boolean;
      pagination: DoctorDashboardPagination;
    };

/** Ported from server.js renderDoctorDashboard (public/app.js ~L1489-1514). */
export function DoctorDashboard(props: DoctorDashboardProps) {
  const { data } = props;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="New cases" value={data.newCases} description="Sent to you, not yet started" />
        <StatCard label="Submitted for HR review" value={data.submittedForHrReview} />
        <StatCard label="Processed this month" value={data.processedThisMonth} />
      </div>

      <SectionCard title="Inbox medicals">
        <DoctorCaseTable cases={data.inbox} variant="inbox" />
      </SectionCard>

      {props.showHistory ? (
        <SectionCard
          title="Case history"
          description={`${data.history.length} case${data.history.length === 1 ? '' : 's'}${props.hasActiveFilters ? ' matching these filters' : ' processed so far'}`}
        >
          <div className="flex flex-col gap-4">
            <DoctorCaseHistoryFilters
              basePath={props.basePath}
              status={props.filters.status}
              from={props.filters.from}
              to={props.filters.to}
              hasActiveFilters={props.hasActiveFilters}
            />
            <DoctorCaseTable
              cases={props.historyPageRows}
              emptyMessage={props.hasActiveFilters ? 'No cases match these filters.' : "This doctor hasn't processed any cases yet."}
            />
            <Pagination page={props.pagination.page} totalPages={props.pagination.totalPages} hrefForPage={props.pagination.hrefForPage} />
          </div>
        </SectionCard>
      ) : (
        <div className="flex items-center justify-between gap-4 rounded-md border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">
            Looking for a case you already processed, or what you've been paid? That's on your billing report now.
          </p>
          <Button size="sm" variant="secondary" asChild>
            <Link href="/billing">
              <DollarSign className="mr-1.5 h-3.5 w-3.5" /> View billing report
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
