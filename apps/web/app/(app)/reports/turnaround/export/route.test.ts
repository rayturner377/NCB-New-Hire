import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const getCaseTurnaroundReportMock = vi.fn();

vi.mock('../../../../../lib/session', () => ({
  getSession: (...args: unknown[]) => getSessionMock(...args)
}));
vi.mock('../../../../../features/reports/services/turnaround-report-service', () => ({
  getCaseTurnaroundReport: (...args: unknown[]) => getCaseTurnaroundReportMock(...args)
}));

const { GET } = await import('./route');

describe('GET /reports/turnaround/export', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getCaseTurnaroundReportMock.mockReset();
    getCaseTurnaroundReportMock.mockResolvedValue({
      fromMilestone: 'doctorSubmittedAt',
      toMilestone: 'reviewedAt',
      casesCounted: 1,
      averageDays: 2,
      minDays: 2,
      maxDays: 2,
      rows: [{ id: 'case_1', patientFullName: 'Jane Doe', fromDate: '2026-01-01T00:00:00.000Z', toDate: '2026-01-03T00:00:00.000Z', turnaroundDays: 2 }]
    });
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await GET(new Request('http://x/reports/turnaround/export'));

    expect(response.status).toBe(401);
  });

  it('rejects a role without REPORTS_VIEW (e.g. a doctor)', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'clinician' } });

    const response = await GET(new Request('http://x/reports/turnaround/export'));

    expect(response.status).toBe(404);
    expect(getCaseTurnaroundReportMock).not.toHaveBeenCalled();
  });

  it('returns CSV with headers named after the selected milestones, passing filters through', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer', role: 'reviewer' } });

    const response = await GET(
      new Request('http://x/reports/turnaround/export?fromMilestone=createdAt&toMilestone=paymentConfirmedAt&from=2026-01-01&to=2026-01-31&query=jane')
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toContain('turnaround.csv');
    expect(getCaseTurnaroundReportMock).toHaveBeenCalledWith({
      fromMilestone: 'createdAt',
      toMilestone: 'paymentConfirmedAt',
      from: '2026-01-01',
      to: '2026-01-31',
      query: 'jane'
    });
    expect(body).toContain('Jane Doe');
    expect(body).toContain('Doctor submitted');
    expect(body).toContain('HR reviewed');
  });

  it('returns a real .xlsx workbook when format=xlsx is requested', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin', role: 'admin' } });

    const response = await GET(new Request('http://x/reports/turnaround/export?format=xlsx'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(response.headers.get('Content-Disposition')).toContain('turnaround.xlsx');
    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
  });
});
