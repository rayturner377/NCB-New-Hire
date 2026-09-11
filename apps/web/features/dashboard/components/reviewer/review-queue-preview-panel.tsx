import Link from "next/link";
import { SectionCard } from "../../../../components/dashboard/section-card";
import { SlaDot } from "../../../../components/dashboard/sla-badge";
import { Button } from "../../../../components/ui/button";
import {
  DataTable,
  type DataTableColumn,
} from "../../../../components/ui/data-table";
import { TooltipProvider } from "../../../../components/ui/tooltip";
import { reviewQueueSlaStatus } from "../../../../lib/sla";
import type { ReviewQueuePreviewRow } from "../../services/reviewer/reviewer-dashboard-service";

export interface ReviewQueuePreviewPanelProps {
  rows: ReviewQueuePreviewRow[];
}

function daysWaitingFor(row: ReviewQueuePreviewRow): number {
  const millisPerDay = 24 * 60 * 60 * 1000;
  return Math.max(
    0,
    Math.round((Date.now() - new Date(row.doctorSubmittedAt).getTime()) / millisPerDay),
  );
}

/**
 * Left-hand panel: the 5 oldest cases sitting in the HR review queue
 * (oldest-arrived first), as a table: who it's for, who sent it, and how
 * long it's been waiting. SLA status is a small always-visible colored dot
 * with a tooltip for the exact wording, rather than a dedicated column — a
 * hover-only tooltip alone wouldn't work on touch devices, and a full column
 * ate too much width in an already-tight table. Each row navigates to that
 * case (via DataTable's getRowHref). `rows` comes from
 * reviewer-dashboard-service.ts's getReviewerDashboardData — the same
 * membership/ordering rule as cases-service.ts's listReviewQueueCases.
 */
export function ReviewQueuePreviewPanel({ rows }: ReviewQueuePreviewPanelProps) {
  const columns: DataTableColumn<ReviewQueuePreviewRow>[] = [
    {
      key: "patient",
      header: "Patient",
      render: (row) => (
        <div className="flex max-w-[9rem] flex-col">
          <span className="truncate whitespace-nowrap text-xs font-semibold">
            {row.patientName}
          </span>
          <span className="truncate whitespace-nowrap text-[11px] text-muted-foreground">
            {row.positionAppliedFor}
          </span>
        </div>
      ),
    },
    {
      key: "assignedClinician",
      header: "Sent by",
      render: (row) => (
        <span className="block max-w-[75px] truncate whitespace-nowrap text-xs text-muted-foreground sm:max-w-[90px] lg:max-w-[135px]">
          {row.assignedClinicianName}
        </span>
      ),
    },
    {
      key: "submitted",
      header: "Received",
      render: (row) => {
        const daysWaiting = daysWaitingFor(row);
        const sla = reviewQueueSlaStatus(daysWaiting);
        return (
          <div className="flex items-center gap-2">
            <SlaDot
              {...sla}
              detail={`${daysWaiting} ${daysWaiting === 1 ? "day" : "days"} waiting`}
            />
            <div className="flex flex-col">
              <span className="whitespace-nowrap text-[11px]">
                {new Date(row.doctorSubmittedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                {daysWaiting} {daysWaiting === 1 ? "day" : "days"} ago
              </span>
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <SectionCard title="Cases queue">
      <TooltipProvider delayDuration={200}>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          emptyMessage="Nothing waiting on HR right now."
          getRowHref={(row) => `/cases/${row.id}`}
        />
      </TooltipProvider>
      <div className="mt-3 flex justify-center border-t pt-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/cases">View full queue</Link>
        </Button>
      </div>
    </SectionCard>
  );
}
