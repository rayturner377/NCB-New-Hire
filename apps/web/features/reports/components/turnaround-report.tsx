import { ArrowDownWideNarrow, ArrowUpNarrowWide, Gauge } from 'lucide-react';
import { ExportButtons } from '../../../components/dashboard/export-buttons';
import { SectionCard } from '../../../components/dashboard/section-card';
import { StatCard } from '../../../components/dashboard/stat-card';
import { Pagination } from '../../../components/dashboard/pagination';
import { milestoneLabel } from '../case-milestones';
import type { TurnaroundReportData, TurnaroundRow } from '../services/turnaround-report-service';
import { TurnaroundReportFilters } from './turnaround-report-filters';
import { TurnaroundReportTable } from './turnaround-report-table';

export interface TurnaroundReportProps {
  data: TurnaroundReportData;
  pageRows: TurnaroundRow[];
  filters: { query: string; from: string; to: string };
  hasActiveFilters: boolean;
  rangeLabel: string;
  exportHref: string;
  pagination: { page: number; totalPages: number; hrefForPage: (page: number) => string };
}

function formatDays(value: number): string {
  return `${value.toFixed(1)}d`;
}

/** How long cases take between any two lifecycle milestones a person picks — see the service's own doc comment for why this replaced a fixed HR-only turnaround. */
export function TurnaroundReport({ data, pageRows, filters, hasActiveFilters, rangeLabel, exportHref, pagination }: TurnaroundReportProps) {
  const fromLabel = milestoneLabel(data.fromMilestone);
  const toLabel = milestoneLabel(data.toMilestone);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Turnaround</h1>
        <p className="text-sm text-muted-foreground">
          How long cases take from &ldquo;{fromLabel}&rdquo; to &ldquo;{toLabel}&rdquo; — {rangeLabel}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Cases counted" value={data.casesCounted} description={rangeLabel} icon={Gauge} />
        <StatCard label="Average turnaround" value={formatDays(data.averageDays)} description={rangeLabel} icon={Gauge} />
        <StatCard label="Fastest" value={formatDays(data.minDays)} description={rangeLabel} icon={ArrowDownWideNarrow} />
        <StatCard label="Slowest" value={formatDays(data.maxDays)} description={rangeLabel} icon={ArrowUpNarrowWide} />
      </div>

      <SectionCard
        title="Cases"
        description={`${data.rows.length} case${data.rows.length === 1 ? '' : 's'}${hasActiveFilters ? ' matching these filters' : ''}`}
        action={<ExportButtons href={exportHref} />}
      >
        <div className="flex flex-col gap-4">
          <TurnaroundReportFilters
            fromMilestone={data.fromMilestone}
            toMilestone={data.toMilestone}
            query={filters.query}
            from={filters.from}
            to={filters.to}
            hasActiveFilters={hasActiveFilters}
          />
          <TurnaroundReportTable
            fromMilestone={data.fromMilestone}
            toMilestone={data.toMilestone}
            rows={pageRows}
            emptyMessage={hasActiveFilters ? 'No cases match these filters.' : 'No cases have reached both of these points yet.'}
          />
          <Pagination page={pagination.page} totalPages={pagination.totalPages} hrefForPage={pagination.hrefForPage} />
        </div>
      </SectionCard>
    </div>
  );
}
