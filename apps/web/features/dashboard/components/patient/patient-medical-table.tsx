import Link from 'next/link';
import { DataTable, type DataTableColumn } from '../../../../components/ui/data-table';
import { StatusBadge } from '../../../../components/ui/status-badge';
import type { PatientCaseRow } from '../../services/patient/patient-dashboard-service';

export interface PatientMedicalTableProps {
  cases: PatientCaseRow[];
}

/** Every row this table ever renders has already left `sent_to_patient` (see patient-dashboard.tsx — those live in "Action required" instead), so every action here is a read-only review, never a continue. */
const ACTION_LABEL: Record<string, string> = {
  patient_completed: 'Review',
  sent_to_doctor: 'Review',
  doctor_submitted: 'Review',
  reviewed: 'Review'
};

/** Ported from server.js's medical-history-list (public/app.js renderMyMedicalRows ~L9306-9323), now over the patient's real cases. There's no per-case "type" field in the schema (every case here is the same pre-employment medical this platform exists for), so the case column identifies rows by id rather than a fabricated title. */
export function PatientMedicalTable({ cases }: PatientMedicalTableProps) {
  const columns: DataTableColumn<PatientCaseRow>[] = [
    {
      key: 'case',
      header: 'Case',
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">Pre-employment medical</span>
          <span className="text-xs text-muted-foreground">{row.id}</span>
        </div>
      )
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdAt', header: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    {
      key: 'actions',
      header: 'Action',
      render: (row) => (
        <Link href={`/cases/${row.id}`} className="text-sm font-medium text-primary hover:underline">
          {ACTION_LABEL[row.status] ?? 'Review'}
        </Link>
      )
    }
  ];

  return (
    <DataTable columns={columns} rows={cases} getRowKey={(row) => row.id} emptyMessage="No medical cases are linked to your profile yet." />
  );
}
