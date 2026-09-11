import type { ReactNode } from 'react';
import { ClickableTableRow } from './clickable-table-row';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

export interface DataTableColumn<Row> {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  getRowKey: (row: Row) => string;
  emptyMessage?: string;
  /** Optional per-row class, e.g. a faint status tint. */
  rowClassName?: (row: Row) => string | undefined;
  /** When provided, each row navigates to this href on click/Enter (see ClickableTableRow). */
  getRowHref?: (row: Row) => string;
}

const HEAD_CLASS = 'h-auto px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground';
const CELL_CLASS = 'px-3 py-2.5';

/**
 * Generic, typed list table — every feature's list screen (candidates, cases,
 * submissions, users, ...) renders through this instead of hand-writing a
 * <table> each time. Built on shadcn/ui's Table primitives so every table in
 * the app shares the same base look.
 */
export function DataTable<Row>({
  columns,
  rows,
  getRowKey,
  emptyMessage = 'No results.',
  rowClassName,
  getRowHref
}: DataTableProps<Row>) {
  if (rows.length === 0) {
    return <p className="text-sm italic text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.key} className={HEAD_CLASS}>
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const cells = columns.map((column) => (
            <TableCell key={column.key} className={CELL_CLASS}>
              {column.render(row)}
            </TableCell>
          ));
          return getRowHref ? (
            <ClickableTableRow key={getRowKey(row)} href={getRowHref(row)} className={rowClassName?.(row)}>
              {cells}
            </ClickableTableRow>
          ) : (
            <TableRow key={getRowKey(row)} className={rowClassName?.(row)}>
              {cells}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
