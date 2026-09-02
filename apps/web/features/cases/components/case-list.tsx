import type { MedicalCase } from '@ncb/database';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { transitionCaseAction } from '../actions/transition-case';

export type CaseRow = MedicalCase & { payload: unknown };

export interface CaseListProps {
  cases: CaseRow[];
  canTransition: boolean;
}

function nextStatusFor(status: string): string | null {
  if (status === 'sent_to_doctor') return 'doctor_submitted';
  if (status === 'doctor_submitted' || status === 'review_pending') return 'reviewed';
  return null;
}

function nextStatusLabel(nextStatus: string): string {
  return nextStatus === 'doctor_submitted' ? 'Mark doctor submitted' : 'Mark reviewed';
}

/** Each row's transition buttons are their own tiny no-JS-required form, same pattern as candidate assign/withdraw. */
export function CaseList({ cases, canTransition }: CaseListProps) {
  const columns: DataTableColumn<CaseRow>[] = [
    { key: 'patientId', header: 'Candidate', render: (row) => row.patientId },
    { key: 'route', header: 'Route', render: (row) => row.route },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'assignedClinicianId',
      header: 'Assigned clinician',
      render: (row) => row.assignedClinicianId || '—'
    }
  ];

  if (canTransition) {
    columns.push({
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const nextStatus = nextStatusFor(row.status);
        const canArchive = row.status !== 'archived' && row.status !== 'withdrawn';
        return (
          <div className="case-row-actions">
            {nextStatus ? (
              <form action={transitionCaseAction} className="case-inline-form">
                <input type="hidden" name="caseId" value={row.id} />
                <input type="hidden" name="version" value={row.version} />
                <input type="hidden" name="newStatus" value={nextStatus} />
                <button type="submit">{nextStatusLabel(nextStatus)}</button>
              </form>
            ) : null}
            {canArchive ? (
              <form action={transitionCaseAction} className="case-inline-form">
                <input type="hidden" name="caseId" value={row.id} />
                <input type="hidden" name="version" value={row.version} />
                <input type="hidden" name="newStatus" value="archived" />
                <button type="submit">Archive</button>
              </form>
            ) : null}
          </div>
        );
      }
    });
  }

  return <DataTable columns={columns} rows={cases} getRowKey={(row) => row.id} emptyMessage="No cases yet." />;
}
