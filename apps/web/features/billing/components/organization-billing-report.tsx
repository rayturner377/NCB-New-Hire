import { CheckCircle2, Clock, FileStack } from 'lucide-react';
import { ExportButtons } from '../../../components/dashboard/export-buttons';
import { Pagination } from '../../../components/dashboard/pagination';
import { SectionCard } from '../../../components/dashboard/section-card';
import { StatCard } from '../../../components/dashboard/stat-card';
import { formatCurrency } from '../../../lib/currency';
import type { BillingReportRow, OrganizationBillingData } from '../services/billing-report-service';
import { BillingReportTable } from './billing-report-table';
import { OrganizationBillingFilters } from './organization-billing-filters';
import { OrganizationBillingSummaryTable } from './organization-billing-summary-table';

export interface OrganizationBillingReportProps {
  data: OrganizationBillingData;
  pageRows: BillingReportRow[];
  selectedDoctorName?: string;
  filters: { clinicianId: string; query: string; billing: string; fy: string; from: string; to: string };
  hasActiveFilters: boolean;
  rangeLabel: string;
  exportHref: string;
  pagination: { page: number; totalPages: number; hrefForPage: (page: number) => string };
}

/**
 * The admin/reviewer equivalent of a doctor's own /billing — org-wide
 * totals up top always; below that, either a per-doctor summary (default)
 * or one doctor's case-level detail once picked via the filter's doctor
 * select (see billing-report-service.ts's getOrganizationBillingReport for
 * why those are mutually exclusive rather than both shown at once).
 */
export function OrganizationBillingReport({
  data,
  pageRows,
  selectedDoctorName,
  filters,
  hasActiveFilters,
  rangeLabel,
  exportHref,
  pagination
}: OrganizationBillingReportProps) {
  const isDrilledDown = Boolean(filters.clinicianId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Billing report</h1>
        <p className="text-sm text-muted-foreground">
          {isDrilledDown ? `${selectedDoctorName}'s` : 'Every doctor\'s'} paid and outstanding billing — {rangeLabel}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Paid" value={formatCurrency(data.paidTotal)} description={rangeLabel} icon={CheckCircle2} />
        <StatCard label="Outstanding" value={formatCurrency(data.outstandingTotal)} description={rangeLabel} icon={Clock} />
        <StatCard label="Cases processed" value={data.casesProcessed} description={rangeLabel} icon={FileStack} />
      </div>

      <SectionCard
        title={isDrilledDown ? `${selectedDoctorName}'s billed cases` : 'Billing by doctor'}
        description={isDrilledDown ? `${data.rows?.length ?? 0} case${data.rows?.length === 1 ? '' : 's'}${hasActiveFilters ? ' matching these filters' : ''}` : undefined}
        action={<ExportButtons href={exportHref} />}
      >
        <div className="flex flex-col gap-4">
          <OrganizationBillingFilters
            doctors={data.doctors}
            availableFinancialYears={data.availableFinancialYears}
            clinicianId={filters.clinicianId}
            query={filters.query}
            billing={filters.billing}
            fy={filters.fy}
            from={filters.from}
            to={filters.to}
            hasActiveFilters={hasActiveFilters}
          />

          {isDrilledDown ? (
            <>
              <BillingReportTable
                rows={pageRows}
                emptyMessage={hasActiveFilters ? 'No billed cases match these filters.' : 'No billed cases for this doctor in this period.'}
              />
              <Pagination page={pagination.page} totalPages={pagination.totalPages} hrefForPage={pagination.hrefForPage} />
            </>
          ) : (
            <OrganizationBillingSummaryTable rows={data.byDoctor ?? []} />
          )}
        </div>
      </SectionCard>
    </div>
  );
}
