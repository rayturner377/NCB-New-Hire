import { NextResponse } from 'next/server';
import { csvFilename, toCsv } from '../../../../lib/csv';
import { PERMISSIONS, hasPermission } from '../../../../lib/permissions';
import { statusLabel } from '../../../../lib/status-labels';
import { getSession } from '../../../../lib/session';
import { getDoctorBillingReport, getOrganizationBillingReport, type BillingReportRow } from '../../../../features/billing/services/billing-report-service';

function billingRowsToCsv(rows: BillingReportRow[]): string {
  return toCsv(
    ['Candidate', 'Position', 'Case status', 'Billing', 'Amount', 'Doctor submitted'],
    rows.map((row) => [
      row.patientFullName,
      row.positionAppliedFor,
      statusLabel(row.status),
      statusLabel(row.billingStatus),
      row.payableAmount,
      row.doctorSubmittedAt ?? ''
    ])
  );
}

/**
 * Same role dispatch as billing/page.tsx (a clinician's own report vs. the admin/reviewer/auditor
 * org-wide one), exporting every row the current filters match rather than just the visible page.
 * The org report, undrilled (no clinicianId), has no case-level rows at all — its own screen shows
 * a per-doctor summary table instead, so that's what gets exported in that state too, rather than
 * an empty or misleading case list.
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

  if (session.user.role === 'clinician') {
    const data = await getDoctorBillingReport(session.user.id, { billing, from, to, query });
    return new NextResponse(billingRowsToCsv(data.rows), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${csvFilename('billing-report')}"`,
        'Cache-Control': 'private, no-store'
      }
    });
  }

  if (!hasPermission(session.user, PERMISSIONS.REPORTS_VIEW)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const clinicianId = url.searchParams.get('clinicianId') ?? '';
  const data = await getOrganizationBillingReport({ billing, from, to, query, clinicianId });

  const body = clinicianId
    ? billingRowsToCsv(data.rows ?? [])
    : toCsv(
        ['Doctor', 'Paid', 'Outstanding', 'Cases processed'],
        (data.byDoctor ?? []).map((row) => [row.clinicianName, row.paidTotal, row.outstandingTotal, row.casesProcessed])
      );

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename('organization-billing-report')}"`,
      'Cache-Control': 'private, no-store'
    }
  });
}
