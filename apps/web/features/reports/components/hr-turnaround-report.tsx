import { ArrowDownWideNarrow, ArrowUpNarrowWide, Download, Gauge } from 'lucide-react';
import Link from 'next/link';
import { Pagination } from '../../../components/dashboard/pagination';
import { SectionCard } from '../../../components/dashboard/section-card';
import { StatCard } from '../../../components/dashboard/stat-card';
import { Button } from '../../../components/ui/button';
import type { HrTurnaroundReportData, HrTurnaroundRow } from '../services/hr-turnaround-report-service';
import { HrTurnaroundReportFilters } from './hr-turnaround-report-filters';
import { HrTurnaroundReportTable } from './hr-turnaround-report-table';

export interface HrTurnaroundReportProps {
  data: HrTurnaroundReportData;
  pageRows: HrTurnaroundRow[];
  filters: { query: string; from: string; to: string };
  hasActiveFilters: boolean;
  rangeLabel: string;
  exportHref: string;
  pagination: { page: number; totalPages: number; hrefForPage: (page: number) => string };
}

function formatDays(value: number): string {
  return `${value.toFixed(1)}d`;
}

/** How long HR itself takes to review a case once a doctor submits it — not the case's whole lifecycle (see the service's own doc comment on the distinction from the dashboard's average). */
export function HrTurnaroundReport({ data, pageRows, filters, hasActiveFilters, rangeLabel, exportHref, pagination }: HrTurnaroundReportProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">HR review turnaround</h1>
        <p className="text-sm text-muted-foreground">How long cases sit with HR between a doctor&apos;s submission and review — {rangeLabel}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Cases reviewed" value={data.casesReviewed} description={rangeLabel} icon={Gauge} />
        <StatCard label="Average turnaround" value={formatDays(data.averageDays)} description={rangeLabel} icon={Gauge} />
        <StatCard label="Fastest" value={formatDays(data.minDays)} description={rangeLabel} icon={ArrowDownWideNarrow} />
        <StatCard label="Slowest" value={formatDays(data.maxDays)} description={rangeLabel} icon={ArrowUpNarrowWide} />
      </div>

      <SectionCard
        title="Reviewed cases"
        description={`${data.rows.length} case${data.rows.length === 1 ? '' : 's'}${hasActiveFilters ? ' matching these filters' : ''}`}
        action={
          <Button variant="outline" size="sm" asChild>
            <Link href={exportHref} prefetch={false}>
              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Export CSV
            </Link>
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <HrTurnaroundReportFilters query={filters.query} from={filters.from} to={filters.to} hasActiveFilters={hasActiveFilters} />
          <HrTurnaroundReportTable
            rows={pageRows}
            emptyMessage={hasActiveFilters ? 'No reviewed cases match these filters.' : 'No cases have been reviewed in this period.'}
          />
          <Pagination page={pagination.page} totalPages={pagination.totalPages} hrefForPage={pagination.hrefForPage} />
        </div>
      </SectionCard>
    </div>
  );
}
