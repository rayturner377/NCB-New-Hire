import Link from 'next/link';
import { DataTable, type DataTableColumn } from '../../../../components/ui/data-table';
import { StatusBadge } from '../../../../components/ui/status-badge';
import type { DoctorCaseRow } from '../../services/doctor/doctor-dashboard-service';

export interface DoctorCaseTableProps {
  cases: DoctorCaseRow[];
  emptyMessage?: string;
  /**
   * 'inbox' rows are always `sent_to_doctor` — a Status column would just
   * repeat that on every row, so it's dropped in favor of when the case
   * actually landed in this inbox. 'history' (the default) keeps Status,
   * since that's the whole point of a history table.
   */
  variant?: 'inbox' | 'history';
}

/** Ported from server.js renderDoctorCaseRows (public/app.js ~L1793-1816). */
export function DoctorCaseTable({ cases, emptyMessage = 'No inbox medicals.', variant = 'history' }: DoctorCaseTableProps) {
  const columns: DataTableColumn<DoctorCaseRow>[] = [
    {
      key: 'patient',
      header: 'Candidate',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.patient.fullName}</span>
          {row.patient.employeeId ? <span className="text-xs text-muted-foreground">{row.patient.employeeId}</span> : null}
        </div>
      )
    },
    ...(variant === 'history'
      ? [{ key: 'status', header: 'Status', render: (row: DoctorCaseRow) => <StatusBadge status={row.status} /> }]
      : []),
    {
      key: 'assignedAt',
      header: variant === 'inbox' ? 'Sent to you' : 'Assigned',
      render: (row) => (row.assignedAt ? new Date(row.assignedAt).toLocaleString() : '—')
    },
    {
      key: 'actions',
      header: 'Action',
      render: (row) =>
        row.status === 'sent_to_doctor' ? (
          <Link href={`/submissions/new?caseId=${row.id}`} className="text-sm font-medium text-primary hover:underline">
            {row.payload?.doctorAssessmentDraft ? 'Continue' : 'Open case'}
          </Link>
        ) : (
          <Link href={`/cases/${row.id}`} className="text-sm font-medium text-primary hover:underline">
            View
          </Link>
        )
    }
  ];

  return <DataTable columns={columns} rows={cases} getRowKey={(row) => row.id} emptyMessage={emptyMessage} />;
}
