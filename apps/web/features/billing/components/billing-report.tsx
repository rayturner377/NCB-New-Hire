import { CheckCircle2, Clock, FileStack } from 'lucide-react';
import { ExportButtons } from '../../../components/dashboard/export-buttons';
import { Pagination } from '../../../components/dashboard/pagination';
import { SectionCard } from '../../../components/dashboard/section-card';
import { StatCard } from '../../../components/dashboard/stat-card';
import { formatCurrency } from '../../../lib/currency';
import type { BillingReportData, BillingReportRow } from '../services/billing-report-service';
import { BillingReportFilters } from './billing-report-filters';
import { BillingReportTable } from './billing-report-table';

export interface BillingReportProps {
  data: BillingReportData;
  pageRows: BillingReportRow[];
  filters: { query: string; billing: string; from: string; to: string };
  hasActiveFilters: boolean;
  rangeLabel: string;
  exportHref: string;
  pagination: { page: number; totalPages: number; hrefForPage: (page: number) => string };
}

/** A doctor's own earnings — how much they've been paid, how much is still outstanding, and how many cases that reflects, over whatever date range they pick. */
export function BillingReport({ data, pageRows, filters, hasActiveFilters, rangeLabel, exportHref, pagination }: BillingReportProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Billing report</h1>
        <p className="text-sm text-muted-foreground">What you've been paid, what's still outstanding, and what you've processed — {rangeLabel}.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Paid" value={formatCurrency(data.paidTotal)} description={rangeLabel} icon={CheckCircle2} />
        <StatCard label="Outstanding" value={formatCurrency(data.outstandingTotal)} description={rangeLabel} icon={Clock} />
        <StatCard label="Cases processed" value={data.casesProcessed} description={rangeLabel} icon={FileStack} />
      </div>

      <SectionCard
        title="Billed cases"
        description={`${data.rows.length} case${data.rows.length === 1 ? '' : 's'}${hasActiveFilters ? ' matching these filters' : ''}`}
        action={<ExportButtons href={exportHref} />}
      >
        <div className="flex flex-col gap-4">
          <BillingReportFilters query={filters.query} billing={filters.billing} from={filters.from} to={filters.to} hasActiveFilters={hasActiveFilters} />
          <BillingReportTable
            rows={pageRows}
            emptyMessage={hasActiveFilters ? 'No billed cases match these filters.' : "You haven't been billed for any cases in this period."}
          />
          <Pagination page={pagination.page} totalPages={pagination.totalPages} hrefForPage={pagination.hrefForPage} />
        </div>
      </SectionCard>
    </div>
  );
}
