import Link from 'next/link';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import type { HrTurnaroundRow } from '../services/hr-turnaround-report-service';

export interface HrTurnaroundReportTableProps {
  rows: HrTurnaroundRow[];
  emptyMessage: string;
}

export function HrTurnaroundReportTable({ rows, emptyMessage }: HrTurnaroundReportTableProps) {
  const columns: DataTableColumn<HrTurnaroundRow>[] = [
    {
      key: 'patient',
      header: 'Candidate',
      render: (row) => (
        <Link href={`/cases/${row.id}`} className="text-sm font-medium text-primary hover:underline">
          {row.patientFullName}
        </Link>
      )
    },
    {
      key: 'submitted',
      header: 'Doctor submitted',
      render: (row) => <span className="text-xs text-muted-foreground">{new Date(row.doctorSubmittedAt).toLocaleDateString()}</span>
    },
    {
      key: 'reviewed',
      header: 'HR reviewed',
      render: (row) => <span className="text-xs text-muted-foreground">{new Date(row.reviewedAt).toLocaleDateString()}</span>
    },
    {
      key: 'turnaround',
      header: 'Turnaround',
      render: (row) => <span className="text-xs font-medium">{row.turnaroundDays.toFixed(1)} days</span>
    }
  ];

  return <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} emptyMessage={emptyMessage} />;
}
