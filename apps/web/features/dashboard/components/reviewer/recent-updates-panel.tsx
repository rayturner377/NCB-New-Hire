import Link from 'next/link';
import { SectionCard } from '../../../../components/dashboard/section-card';
import { Button } from '../../../../components/ui/button';
import { DataTable, type DataTableColumn } from '../../../../components/ui/data-table';
import { formatRelativeTime } from '../../../../lib/relative-time';
import type { RecentUpdateRow } from '../../services/reviewer/reviewer-dashboard-service';

export interface RecentUpdatesPanelProps {
  events: RecentUpdateRow[];
}

/**
 * Right-hand panel: a feed of recent case- and user-account audit events (who
 * submitted, transitioned, reassigned, created, or deactivated what). Same
 * rules as ReviewQueuePreviewPanel's table — DataTable, truncated secondary
 * text, one line per row, rows link out via `getRowHref`. `events` comes from
 * reviewer-dashboard-service.ts's getReviewerDashboardData, already limited
 * to a handful of the most recent case/user events (login/logout/access-denied
 * audit entries are excluded — this feed is about case and account activity,
 * not session activity). The "View full audit log" link below is the only way
 * to see everything, filtered and searchable — see /audit.
 */
export function RecentUpdatesPanel({ events }: RecentUpdatesPanelProps) {
  const columns: DataTableColumn<RecentUpdateRow>[] = [
    {
      key: 'action',
      header: 'Update',
      render: (event) => (
        <div className="flex max-w-[8rem] flex-col sm:max-w-[9rem]">
          <span className="truncate whitespace-nowrap text-xs font-semibold">{event.action}</span>
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">
            {new Date(event.occurredAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ·{' '}
            {formatRelativeTime(event.occurredAt)}
          </span>
        </div>
      )
    },
    {
      key: 'actor',
      header: 'By',
      render: (event) => (
        <div className="flex flex-col">
          <span className="truncate whitespace-nowrap text-xs font-semibold">{event.actorName}</span>
          <span className="truncate whitespace-nowrap text-[11px] text-muted-foreground">{event.actorRole}</span>
        </div>
      )
    },
    {
      key: 'impacted',
      header: 'Impacted',
      render: (event) => (
        <div className="flex max-w-[75px] flex-col sm:max-w-[90px] lg:max-w-[120px]">
          <span className="truncate whitespace-nowrap text-xs font-semibold">{event.impactedLabel}</span>
          <span className="truncate whitespace-nowrap text-[11px] text-muted-foreground">{event.impactedKind}</span>
        </div>
      )
    }
  ];

  return (
    <SectionCard title="Recent updates">
      <div className="flex flex-col gap-3">
        <DataTable
          columns={columns}
          rows={events}
          getRowKey={(event) => event.id}
          emptyMessage="No recent activity."
          getRowHref={(event) => event.href}
        />
        <Button variant="outline" size="sm" className="self-end" asChild>
          <Link href="/audit">View full audit log</Link>
        </Button>
      </div>
    </SectionCard>
  );
}
