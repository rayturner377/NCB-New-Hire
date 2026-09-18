import type { CaseWithPatient } from '@ncb/database';
import { Badge } from '../../../components/ui/badge';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { SlaBadge } from '../../../components/ui/sla-badge';
import { StatusBadge } from '../../../components/ui/status-badge';
import type { SlaDefinition } from '../../settings/types';
import { caseRouteLabel, caseStageLabel } from '../case-stage';
import { caseTypeLabel } from '../case-types';
import { computeSlaStatus, overallSlaStatus } from '../sla';
import type { CasePayload } from '../services/cases-service';

export type CaseRow = CaseWithPatient<CasePayload>;

export interface CaseListProps {
  cases: CaseRow[];
  /** Admin-configured SLA policies (Settings → SLA) — omit the column entirely rather than show a meaningless badge when there's nothing to measure against. */
  slaDefinitions?: SlaDefinition[];
}

/** Rows navigate to the case's tabbed workspace (/cases/[id]) — status changes/billing/review now live there, not inline in the list. */
export function CaseList({ cases, slaDefinitions = [] }: CaseListProps) {
  const columns: DataTableColumn<CaseRow>[] = [
    {
      key: 'patient',
      header: 'Candidate',
      render: (row) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold">{row.patient.fullName}</span>
            {row.payload?.hidden ? (
              <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
                Hidden
              </Badge>
            ) : null}
          </div>
          {row.patient.employeeId ? <span className="text-[11px] text-muted-foreground">{row.patient.employeeId}</span> : null}
        </div>
      )
    },
    { key: 'stage', header: 'Stage', render: (row) => <span className="text-xs">{caseStageLabel(row.status, row.paymentStatus)}</span> },
    { key: 'caseType', header: 'Type', render: (row) => <span className="text-xs">{caseTypeLabel(row.payload?.caseType)}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    ...(slaDefinitions.length
      ? [
          {
            key: 'sla',
            header: 'SLA',
            render: (row: CaseRow) => (
              <SlaBadge
                status={overallSlaStatus(
                  computeSlaStatus(
                    {
                      createdAt: row.createdAt,
                      assignedAt: row.assignedAt,
                      doctorSubmittedAt: row.doctorSubmittedAt,
                      reviewedAt: row.reviewedAt,
                      paymentConfirmedAt: row.paymentConfirmedAt
                    },
                    slaDefinitions
                  )
                )}
              />
            )
          } satisfies DataTableColumn<CaseRow>
        ]
      : []),
    {
      key: 'route',
      header: 'Initial routing',
      render: (row) => <span className="text-xs text-muted-foreground">{caseRouteLabel(row.route)}</span>
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      render: (row) => <span className="text-xs text-muted-foreground">{new Date(row.updatedAt).toLocaleDateString()}</span>
    }
  ];

  return (
    <DataTable columns={columns} rows={cases} getRowKey={(row) => row.id} emptyMessage="No cases yet." getRowHref={(row) => `/cases/${row.id}`} />
  );
}
