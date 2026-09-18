import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import Link from 'next/link';
import type { AuditLogRow } from '../services/audit-log-service';

export interface AuditLogTableProps {
  rows: AuditLogRow[];
}

const HEAD_CLASS = 'h-auto px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground';
const CELL_CLASS = 'px-3 py-2.5 text-sm';

/**
 * Not built on the shared DataTable — every other row in the app links to
 * exactly one place, but an audit row's href is genuinely absent for a
 * deleted case/user or a route-level access_denied event, and DataTable's
 * getRowHref must return a string for every row. Rendered as a plain/
 * linked activity text per row instead, using the same table primitives.
 */
export function AuditLogTable({ rows }: AuditLogTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm italic text-muted-foreground">No activity matches these filters.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={HEAD_CLASS}>When</TableHead>
          <TableHead className={HEAD_CLASS}>Activity</TableHead>
          <TableHead className={HEAD_CLASS}>By</TableHead>
          <TableHead className={HEAD_CLASS}>Affected</TableHead>
          <TableHead className={HEAD_CLASS}>Detail</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const cells = (
            <>
              <TableCell className={CELL_CLASS}>
                {new Date(row.occurredAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </TableCell>
              <TableCell className={CELL_CLASS}>
                {row.href ? (
                  <Link href={row.href} className="font-medium text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`${row.action}: ${row.entityLabel}`}>
                    {row.action}
                  </Link>
                ) : row.action}
              </TableCell>
              <TableCell className={CELL_CLASS}>
                <div className="flex flex-col">
                  <span className="font-medium">{row.actorName}</span>
                  <span className="text-xs text-muted-foreground">{row.actorRole}</span>
                </div>
              </TableCell>
              <TableCell className={CELL_CLASS}>
                <div className="flex flex-col">
                  <span className="font-medium">{row.entityLabel}</span>
                  <span className="text-xs text-muted-foreground">{row.entityKind}</span>
                </div>
              </TableCell>
              <TableCell className={CELL_CLASS}>{row.detail || '—'}</TableCell>
            </>
          );
          return <TableRow key={row.id}>{cells}</TableRow>;
        })}
      </TableBody>
    </Table>
  );
}
