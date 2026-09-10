import { Beaker, Briefcase, CheckCircle2, Mail, UserRound, XCircle } from 'lucide-react';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { formatRelativeTime } from '../../../lib/relative-time';
import type { MessageCategory, MessageRow } from '../services/messages-service';

export interface MessageListProps {
  rows: MessageRow[];
}

const CATEGORY_ICON: Record<MessageCategory, typeof Mail> = {
  case: Briefcase,
  account: UserRound,
  test: Beaker,
  other: Mail
};

export function MessageList({ rows }: MessageListProps) {
  const columns: DataTableColumn<MessageRow>[] = [
    {
      key: 'status',
      header: '',
      render: (row) =>
        row.status === 'failed' ? (
          <XCircle className="h-4 w-4 text-destructive" aria-label="Failed" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="Sent" />
        )
    },
    {
      key: 'subject',
      header: 'Message',
      render: (row) => (
        <div className="flex max-w-[16rem] flex-col">
          <span className="truncate text-xs font-semibold">{row.subject}</span>
          <span className="truncate text-[11px] text-muted-foreground">To {row.to}</span>
        </div>
      )
    },
    {
      key: 'template',
      header: 'Type',
      render: (row) => {
        const Icon = CATEGORY_ICON[row.category];
        return (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{row.templateLabel}</span>
          </div>
        );
      }
    },
    {
      key: 'createdAt',
      header: 'When',
      render: (row) => (
        <div className="flex flex-col">
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {new Date(row.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">{formatRelativeTime(row.createdAt)}</span>
        </div>
      )
    }
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(row) => row.id}
      emptyMessage="No messages match these filters."
      rowClassName={(row) => (row.status === 'failed' ? 'bg-destructive/[0.03]' : undefined)}
      getRowHref={(row) => `/messages/${row.id}`}
    />
  );
}
