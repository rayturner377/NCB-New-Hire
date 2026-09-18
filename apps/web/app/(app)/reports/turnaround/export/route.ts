import { NextResponse } from 'next/server';
import { csvFilename, toCsv } from '../../../../../lib/csv';
import { PERMISSIONS, hasPermission } from '../../../../../lib/permissions';
import { getSession } from '../../../../../lib/session';
import { toXlsxBuffer, xlsxFilename } from '../../../../../lib/xlsx';
import { milestoneLabel } from '../../../../../features/reports/case-milestones';
import { getCaseTurnaroundReport } from '../../../../../features/reports/services/turnaround-report-service';

/** CSV/Excel of every row the turnaround report matches for the given milestones and filters — not just the current page. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  if (!hasPermission(session.user, PERMISSIONS.REPORTS_VIEW)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const url = new URL(request.url);
  const fromMilestone = url.searchParams.get('fromMilestone') ?? undefined;
  const toMilestone = url.searchParams.get('toMilestone') ?? undefined;
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const query = url.searchParams.get('query') ?? '';
  const format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';

  const data = await getCaseTurnaroundReport({ fromMilestone, toMilestone, from, to, query });
  const headers = ['Candidate', milestoneLabel(data.fromMilestone), milestoneLabel(data.toMilestone), 'Turnaround (days)'];
  const rows = data.rows.map((row) => [row.patientFullName, row.fromDate, row.toDate, row.turnaroundDays.toFixed(1)]);

  if (format === 'xlsx') {
    const buffer = await toXlsxBuffer('Turnaround', headers, rows);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${xlsxFilename('turnaround')}"`,
        'Cache-Control': 'private, no-store'
      }
    });
  }

  return new NextResponse(toCsv(headers, rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename('turnaround')}"`,
      'Cache-Control': 'private, no-store'
    }
  });
}
