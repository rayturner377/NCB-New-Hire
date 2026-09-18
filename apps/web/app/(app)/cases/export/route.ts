import { NextResponse } from 'next/server';
import { csvFilename, toCsv } from '../../../../lib/csv';
import { PERMISSIONS, hasPermission } from '../../../../lib/permissions';
import { getSession } from '../../../../lib/session';
import { toXlsxBuffer, xlsxFilename } from '../../../../lib/xlsx';
import { caseRouteLabel, caseStageLabel } from '../../../../features/cases/case-stage';
import { caseTypeLabel } from '../../../../features/cases/case-types';
import { parseBillingFilter } from '../../../../features/cases/billing-status';
import { searchAllCasesWithPatient } from '../../../../features/cases/services/cases-service';

const HEADERS = ['Candidate', 'Employee ID', 'Stage', 'Type', 'Status', 'Initial routing', 'Updated'];

/**
 * The "All cases" tab's export — same role/permission gate and filters as cases-container.tsx,
 * every matching row (not just the visible page), in whichever of the two formats is asked for.
 * Excel via exceljs rather than a CSV wearing a .xlsx name — a real workbook.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  if (
    session.user.role === 'patient' ||
    session.user.role === 'clinician' ||
    session.user.role === 'delegate' ||
    !hasPermission(session.user, PERMISSIONS.MEDICAL_CASES_LIST)
  ) {
    return new NextResponse('Not found', { status: 404 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get('query')?.trim() ?? '';
  const status = url.searchParams.get('status') ?? '';
  const billing = parseBillingFilter(url.searchParams.get('billing') ?? undefined);
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';

  const cases = await searchAllCasesWithPatient({ query, status, billing, from, to });
  const rows: (string | number)[][] = cases.map((item) => [
    item.patient.fullName,
    item.patient.employeeId ?? '',
    caseStageLabel(item.status),
    caseTypeLabel(item.payload?.caseType),
    item.status,
    caseRouteLabel(item.route),
    item.updatedAt.toISOString()
  ]);

  if (format === 'xlsx') {
    const buffer = await toXlsxBuffer('All cases', HEADERS, rows);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${xlsxFilename('all-cases')}"`,
        'Cache-Control': 'private, no-store'
      }
    });
  }

  return new NextResponse(toCsv(HEADERS, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename('all-cases')}"`,
      'Cache-Control': 'private, no-store'
    }
  });
}
