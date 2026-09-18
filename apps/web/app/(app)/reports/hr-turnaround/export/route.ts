import { NextResponse } from 'next/server';
import { csvFilename, toCsv } from '../../../../../lib/csv';
import { PERMISSIONS, hasPermission } from '../../../../../lib/permissions';
import { getSession } from '../../../../../lib/session';
import { getHrReviewTurnaroundReport } from '../../../../../features/reports/services/hr-turnaround-report-service';

/** CSV of every row the HR turnaround report matches for the given filters — not just the current page, the same "export what you filtered to" behavior as the billing report's own export. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  if (!hasPermission(session.user, PERMISSIONS.REPORTS_VIEW)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  const query = url.searchParams.get('query') ?? '';

  const data = await getHrReviewTurnaroundReport({ from, to, query });
  const csv = toCsv(
    ['Candidate', 'Doctor submitted', 'HR reviewed', 'Turnaround (days)'],
    data.rows.map((row) => [row.patientFullName, row.doctorSubmittedAt, row.reviewedAt, row.turnaroundDays.toFixed(1)])
  );

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename('hr-review-turnaround')}"`,
      'Cache-Control': 'private, no-store'
    }
  });
}
