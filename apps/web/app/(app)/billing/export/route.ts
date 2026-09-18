import { NextResponse } from 'next/server';
import { csvFilename, toCsv } from '../../../../lib/csv';
import { PERMISSIONS, hasPermission } from '../../../../lib/permissions';
import { statusLabel } from '../../../../lib/status-labels';
import { getSession } from '../../../../lib/session';
import { toXlsxBuffer, xlsxFilename } from '../../../../lib/xlsx';
import { getDoctorBillingReport, getOrganizationBillingReport, type BillingReportRow } from '../../../../features/billing/services/billing-report-service';

const BILLING_HEADERS = ['Candidate', 'Position', 'Case status', 'Billing', 'Amount', 'Doctor submitted'];
const SUMMARY_HEADERS = ['Doctor', 'Paid', 'Outstanding', 'Cases processed'];

function billingRowsToTable(rows: BillingReportRow[]): (string | number)[][] {
  return rows.map((row) => [
    row.patientFullName,
    row.positionAppliedFor,
    statusLabel(row.status),
    statusLabel(row.billingStatus),
    row.payableAmount,
    row.doctorSubmittedAt ?? ''
  ]);
}

async function respond(sheetName: string, filenameBase: string, headers: string[], rows: (string | number)[][], format: 'csv' | 'xlsx') {
  if (format === 'xlsx') {
    const buffer = await toXlsxBuffer(sheetName, headers, rows);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${xlsxFilename(filenameBase)}"`,
        'Cache-Control': 'private, no-store'
      }
    });
  }
  return new NextResponse(toCsv(headers, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename(filenameBase)}"`,
      'Cache-Control': 'private, no-store'
    }
  });
}

/**
 * Same role dispatch as billing/page.tsx (a clinician's own report vs. the admin/reviewer/auditor
 * org-wide one), exporting every row the current filters match rather than just the visible page,
 * as CSV or a real .xlsx workbook depending on `format`. The org report, undrilled (no
 * clinicianId), has no case-level rows at all — its own screen shows a per-doctor summary table
 * instead, so that's what gets exported in that state too, rather than an empty or misleading case
 * list.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);
  const billing = url.searchParams.get('billing') ?? '';
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const query = url.searchParams.get('query') ?? '';
  const format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';

  if (session.user.role === 'clinician') {
    const data = await getDoctorBillingReport(session.user.id, { billing, from, to, query });
    return respond('Billing report', 'billing-report', BILLING_HEADERS, billingRowsToTable(data.rows), format);
  }

  if (!hasPermission(session.user, PERMISSIONS.REPORTS_VIEW)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const clinicianId = url.searchParams.get('clinicianId') ?? '';
  const data = await getOrganizationBillingReport({ billing, from, to, query, clinicianId });

  if (clinicianId) {
    return respond('Billing report', 'organization-billing-report', BILLING_HEADERS, billingRowsToTable(data.rows ?? []), format);
  }
  const summaryRows = (data.byDoctor ?? []).map((row) => [row.clinicianName, row.paidTotal, row.outstandingTotal, row.casesProcessed]);
  return respond('Billing by doctor', 'organization-billing-report', SUMMARY_HEADERS, summaryRows, format);
}
