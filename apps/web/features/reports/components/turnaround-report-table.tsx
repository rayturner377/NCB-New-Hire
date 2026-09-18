import Link from 'next/link';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import type { CaseMilestoneKey } from '../case-milestones';
import { milestoneLabel } from '../case-milestones';
import type { TurnaroundRow } from '../services/turnaround-report-service';

export interface TurnaroundReportTableProps {
  fromMilestone: CaseMilestoneKey;
  toMilestone: CaseMilestoneKey;
  rows: TurnaroundRow[];
  emptyMessage: string;
}

export function TurnaroundReportTable({ fromMilestone, toMilestone, rows, emptyMessage }: TurnaroundReportTableProps) {
  const columns: DataTableColumn<TurnaroundRow>[] = [
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
      key: 'from',
      header: milestoneLabel(fromMilestone),
      render: (row) => <span className="text-xs text-muted-foreground">{new Date(row.fromDate).toLocaleDateString()}</span>
    },
    {
      key: 'to',
      header: milestoneLabel(toMilestone),
      render: (row) => <span className="text-xs text-muted-foreground">{new Date(row.toDate).toLocaleDateString()}</span>
    },
    {
      key: 'turnaround',
      header: 'Turnaround',
      render: (row) => <span className="text-xs font-medium">{row.turnaroundDays.toFixed(1)} days</span>
    }
  ];

  return <DataTable columns={columns} rows={rows} getRowKey={(row) => row.id} emptyMessage={emptyMessage} />;
}
