import Link from 'next/link';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { formatCurrency } from '../../../lib/currency';
import type { DoctorBillingSummaryRow } from '../services/billing-report-service';

export interface OrganizationBillingSummaryTableProps {
  rows: DoctorBillingSummaryRow[];
}

/** One row per doctor with at least one billed case in range — a doctor's name links to /billing?clinicianId=<id> to drill into their case-level detail (see organization-billing-filters.tsx's doctor picker, which does the same navigation). */
export function OrganizationBillingSummaryTable({ rows }: OrganizationBillingSummaryTableProps) {
  const columns: DataTableColumn<DoctorBillingSummaryRow>[] = [
    {
      key: 'doctor',
      header: 'Doctor',
      render: (row) => (
        <Link href={`/billing?clinicianId=${row.clinicianId}`} className="text-sm font-medium text-primary hover:underline">
          {row.clinicianName}
        </Link>
      )
    },
    { key: 'paid', header: 'Paid', render: (row) => <span className="text-xs">{formatCurrency(row.paidTotal)}</span> },
    { key: 'outstanding', header: 'Outstanding', render: (row) => <span className="text-xs font-medium">{formatCurrency(row.outstandingTotal)}</span> },
    { key: 'cases', header: 'Cases processed', render: (row) => <span className="text-xs">{row.casesProcessed}</span> }
  ];

  return <DataTable columns={columns} rows={rows} getRowKey={(row) => row.clinicianId} emptyMessage="No billed cases in this period." />;
}
