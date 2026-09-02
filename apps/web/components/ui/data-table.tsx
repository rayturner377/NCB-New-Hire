import type { ReactNode } from 'react';

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
}

/**
 * Generic, typed list table — every feature's list screen (candidates, cases,
 * submissions, users, ...) renders through this instead of hand-writing a
 * <table> each time.
 */
export function DataTable<Row>({ columns, rows, getRowKey, emptyMessage = 'No results.' }: DataTableProps<Row>) {
  if (rows.length === 0) {
    return <p className="ui-data-table-empty">{emptyMessage}</p>;
  }

  return (
    <table className="ui-data-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key}>{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={getRowKey(row)}>
            {columns.map((column) => (
              <td key={column.key}>{column.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
