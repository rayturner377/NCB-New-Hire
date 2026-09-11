import Link from 'next/link';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { formatCurrency } from '../../../lib/currency';
import { statusLabel } from '../../../lib/status-labels';
import type { BillingReportRow } from '../services/billing-report-service';

export interface BillingReportTableProps {
  rows: BillingReportRow[];
  emptyMessage: string;
}

export function BillingReportTable({ rows, emptyMessage }: BillingReportTableProps) {
  const columns: DataTableColumn<BillingReportRow>[] = [
    {
      key: 'patient',
      header: 'Candidate',
      render: (row) => (
        <Link href={`/cases/${row.id}`} className="text-sm font-medium text-primary hover:underline">
          {row.patientFullName}
        </Link>
      )
    },
    { key: 'position', header: 'Position', render: (row) => <span className="text-xs">{row.positionAppliedFor || '—'}</span> },
    { key: 'status', header: 'Case status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'billing', header: 'Billing', render: (row) => <span className="text-xs">{statusLabel(row.billingStatus)}</span> },
    { key: 'amount', header: 'Amount', render: (row) => <span className="text-xs font-medium">{formatCurrency(row.payableAmount)}</span> },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (row) => <span className="text-xs text-muted-foreground">{row.doctorSubmittedAt ? new Date(row.doctorSubmittedAt).toLocaleDateString() : '—'}</span>
    }
  ];

  return <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} emptyMessage={emptyMessage} />;
}
