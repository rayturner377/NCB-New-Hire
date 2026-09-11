import { ArrowRight } from 'lucide-react';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import type { CaseHistoryEntry } from '../case-history';

export interface CaseHistoryTabProps {
  entries: CaseHistoryEntry[];
}

/** Every stage move and reassignment against this case, most recent first — a real table (When/Event/From→To/By) rather than a flat sentence-per-line list, so it can be scanned at a glance instead of read line by line. */
export function CaseHistoryTab({ entries }: CaseHistoryTabProps) {
  const columns: DataTableColumn<CaseHistoryEntry>[] = [
    {
      key: 'occurredAt',
      header: 'When',
      render: (entry) => <span className="text-xs text-muted-foreground">{new Date(entry.occurredAt).toLocaleString()}</span>
    },
    { key: 'event', header: 'Event', render: (entry) => <span className="text-xs font-medium">{entry.eventLabel}</span> },
    {
      key: 'change',
      header: 'From → To',
      render: (entry) => (
        <span className="inline-flex items-center gap-1.5 text-xs">
          {entry.from}
          <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          {entry.to}
        </span>
      )
    },
    {
      key: 'actor',
      header: 'By',
      render: (entry) => (
        <div className="flex flex-col">
          <span className="text-xs">{entry.actorName}</span>
          {entry.actorRole !== '—' ? <span className="text-[11px] text-muted-foreground">{entry.actorRole}</span> : null}
        </div>
      )
    }
  ];

  return <DataTable columns={columns} rows={entries} getRowKey={(entry) => entry.id} emptyMessage="No stage changes recorded for this case yet." />;
}
