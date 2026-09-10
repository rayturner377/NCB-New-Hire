import Link from 'next/link';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { derivedPaymentStatus } from '../../cases/billing-status';
import { statusLabel } from '../../../lib/status-labels';
import type { CandidateCaseSummary } from './candidates-table';

export interface CandidateCaseHistoryProps {
  cases: CandidateCaseSummary[];
}

function caseTitle(medicalCase: CandidateCaseSummary): string {
  const number = medicalCase.caseNumber ? `Case #${medicalCase.caseNumber}` : 'Case';
  return medicalCase.positionAppliedFor ? `${number} — ${medicalCase.positionAppliedFor}` : number;
}

/** The "View candidate" page's medical case history — same case-title/column shape as the candidates list's expand panel (see candidates-table.tsx), just for one candidate at a time. */
export function CandidateCaseHistory({ cases }: CandidateCaseHistoryProps) {
  const columns: DataTableColumn<CandidateCaseSummary>[] = [
    {
      key: 'case',
      header: 'Case',
      render: (row) => (
        <Link href={`/cases/${row.id}`} className="text-sm font-medium text-primary hover:underline">
          {caseTitle(row)}
        </Link>
      )
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'billing', header: 'Billing', render: (row) => statusLabel(derivedPaymentStatus(row.status, row.paymentStatus)) },
    { key: 'createdAt', header: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    { key: 'assignedAt', header: 'Assigned', render: (row) => (row.assignedAt ? new Date(row.assignedAt).toLocaleDateString() : '—') }
  ];

  return (
    <DataTable
      columns={columns}
      rows={[...cases].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())}
      getRowKey={(row) => row.id}
      emptyMessage="No medical cases yet."
    />
  );
}
