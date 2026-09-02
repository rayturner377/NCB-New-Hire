import Link from 'next/link';
import type { MedicalCase } from '@ncb/database';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { transitionCaseAction } from '../actions/transition-case';

export type CaseRow = MedicalCase & { payload: unknown };

export interface CaseListProps {
  cases: CaseRow[];
  canTransition: boolean;
  /** Whether to show a "Complete assessment" link for sent_to_doctor cases (features/submissions). */
  canSubmitAssessment: boolean;
}

/**
 * sent_to_doctor -> doctor_submitted is deliberately NOT a quick-transition
 * button here — that transition now only happens as a side effect of
 * actually completing an assessment (features/submissions' createSubmission
 * action), so a reviewer/admin can't jump a case to "doctor submitted"
 * without a real submission existing.
 */
function nextStatusFor(status: string): string | null {
  if (status === 'doctor_submitted' || status === 'review_pending') return 'reviewed';
  return null;
}

/** Each row's transition buttons are their own tiny no-JS-required form, same pattern as candidate assign/withdraw. */
export function CaseList({ cases, canTransition, canSubmitAssessment }: CaseListProps) {
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

  if (canTransition || canSubmitAssessment) {
    columns.push({
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const nextStatus = nextStatusFor(row.status);
        const canArchive = canTransition && row.status !== 'archived' && row.status !== 'withdrawn';
        return (
          <div className="case-row-actions">
            {canSubmitAssessment && row.status === 'sent_to_doctor' ? (
              <Link href={`/submissions/new?caseId=${row.id}`}>Complete assessment</Link>
            ) : null}
            {canTransition && nextStatus ? (
              <form action={transitionCaseAction} className="case-inline-form">
                <input type="hidden" name="caseId" value={row.id} />
                <input type="hidden" name="version" value={row.version} />
                <input type="hidden" name="newStatus" value={nextStatus} />
                <button type="submit">Mark reviewed</button>
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
