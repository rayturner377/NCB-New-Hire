import { Pagination } from '../../../components/dashboard/pagination';
import { SectionCard } from '../../../components/dashboard/section-card';
import type { AuditLogRow } from '../services/audit-log-service';
import { AuditLogFilters } from './audit-log-filters';
import { AuditLogTable } from './audit-log-table';

export interface AuditLogProps {
  rows: AuditLogRow[];
  filters: { eventTypes: string[]; from: string; to: string };
  hasActiveFilters: boolean;
  total: number;
  pagination: { page: number; totalPages: number; hrefForPage: (page: number) => string };
}

/** The full, searchable/filterable audit trail at /audit — reached from the dashboard's "View full audit log" button, since Recent updates there only ever shows a handful of the most recent rows. */
export function AuditLog({ rows, filters, hasActiveFilters, total, pagination }: AuditLogProps) {
  return (
    <SectionCard title="Audit log" description={`${total} event${total === 1 ? '' : 's'} match${total === 1 ? 'es' : ''} these filters`}>
      <div className="flex flex-col gap-4">
        <AuditLogFilters eventTypes={filters.eventTypes} from={filters.from} to={filters.to} hasActiveFilters={hasActiveFilters} />
        <AuditLogTable rows={rows} />
        <Pagination page={pagination.page} totalPages={pagination.totalPages} hrefForPage={pagination.hrefForPage} />
      </div>
    </SectionCard>
  );
}
