import type { MedicalOffice } from '@ncb/database';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { formatAddress } from '../../../lib/address';
import { formatCurrency } from '../../../lib/currency';

export interface MedicalOfficesTableProps {
  offices: MedicalOffice[];
}

/** No search/pagination (unlike Candidates/Cases/Users) — the number of facilities an organization has on file is expected to stay small enough that a plain list is all this needs. */
export function MedicalOfficesTable({ offices }: MedicalOfficesTableProps) {
  const columns: DataTableColumn<MedicalOffice>[] = [
    { key: 'name', header: 'Facility', render: (row) => <span className="text-xs font-semibold">{row.name}</span> },
    {
      key: 'address',
      header: 'Address',
      render: (row) => (
        <span className="text-xs text-muted-foreground">
          {formatAddress({
            addressLine1: row.addressLine1 ?? '',
            addressLine2: row.addressLine2 ?? '',
            city: row.city ?? '',
            state: row.state ?? '',
            country: row.country ?? ''
          }) || '—'}
        </span>
      )
    },
    { key: 'phone', header: 'Phone', render: (row) => <span className="text-xs text-muted-foreground">{row.phone || '—'}</span> },
    {
      key: 'defaultMedicalFee',
      header: 'Default rate',
      render: (row) => <span className="text-xs">{formatCurrency(Number(row.defaultMedicalFee))}</span>
    },
    { key: 'active', header: 'Status', render: (row) => <StatusBadge status={row.active ? 'active' : 'inactive'} /> }
  ];

  return (
    <DataTable
      columns={columns}
      rows={offices}
      getRowKey={(row) => row.id}
      emptyMessage="No medical facilities yet."
      getRowHref={(row) => `/medical-offices/${row.id}`}
    />
  );
}
