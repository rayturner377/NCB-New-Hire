import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { assignCandidateAction } from '../actions/assign-candidate';
import { withdrawCandidateAction } from '../actions/withdraw-candidate';
import type { CandidatePayload } from '../types';

export interface CandidateListProps {
  candidates: CandidatePayload[];
  canAssign: boolean;
}

/**
 * Plain HTML forms (no client component/JS required) for assign/withdraw —
 * each row is its own tiny progressively-enhanced form, matching the
 * no-JS-required pattern server.js's original form-based UI relied on.
 */
export function CandidateList({ candidates, canAssign }: CandidateListProps) {
  const columns: DataTableColumn<CandidatePayload>[] = [
    { key: 'fullName', header: 'Name', render: (row) => row.fullName },
    { key: 'position', header: 'Position', render: (row) => row.position },
    { key: 'employeeId', header: 'Employee ID', render: (row) => row.employeeId || '—' },
    { key: 'assignedClinicianName', header: 'Assigned clinician', render: (row) => row.assignedClinicianName || '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> }
  ];

  if (canAssign) {
    columns.push({
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="candidate-row-actions">
          <form action={assignCandidateAction} className="candidate-inline-form">
            <input type="hidden" name="candidateId" value={row.id} />
            <input
              name="assignedClinicianId"
              placeholder="Clinician user id"
              defaultValue={row.assignedClinicianId}
              required
            />
            <input
              name="assignedClinicianName"
              placeholder="Clinician name"
              defaultValue={row.assignedClinicianName}
              required
            />
            <button type="submit">Assign</button>
          </form>
          {row.status !== 'withdrawn' ? (
            <form action={withdrawCandidateAction} className="candidate-inline-form">
              <input type="hidden" name="candidateId" value={row.id} />
              <input name="withdrawalReason" placeholder="Withdrawal reason" />
              <button type="submit">Withdraw</button>
            </form>
          ) : null}
        </div>
      )
    });
  }

  return (
    <DataTable
      columns={columns}
      rows={candidates}
      getRowKey={(row) => row.id}
      emptyMessage="No candidates yet."
    />
  );
}
