import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const getHrReviewTurnaroundReportMock = vi.fn();

vi.mock('../../../../../lib/session', () => ({
  getSession: (...args: unknown[]) => getSessionMock(...args)
}));
vi.mock('../../../../../features/reports/services/hr-turnaround-report-service', () => ({
  getHrReviewTurnaroundReport: (...args: unknown[]) => getHrReviewTurnaroundReportMock(...args)
}));

const { GET } = await import('./route');

describe('GET /reports/hr-turnaround/export', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getHrReviewTurnaroundReportMock.mockReset();
    getHrReviewTurnaroundReportMock.mockResolvedValue({
      casesReviewed: 1,
      averageDays: 2,
      minDays: 2,
      maxDays: 2,
      rows: [{ id: 'case_1', patientFullName: 'Jane Doe', doctorSubmittedAt: '2026-01-01T00:00:00.000Z', reviewedAt: '2026-01-03T00:00:00.000Z', turnaroundDays: 2 }]
    });
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await GET(new Request('http://x/reports/hr-turnaround/export'));

    expect(response.status).toBe(401);
  });

  it('rejects a role without REPORTS_VIEW (e.g. a doctor)', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'clinician' } });

    const response = await GET(new Request('http://x/reports/hr-turnaround/export'));

    expect(response.status).toBe(404);
    expect(getHrReviewTurnaroundReportMock).not.toHaveBeenCalled();
  });

  it('returns CSV for a reviewer, passing filters through', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer', role: 'reviewer' } });

    const response = await GET(new Request('http://x/reports/hr-turnaround/export?from=2026-01-01&to=2026-01-31&query=jane'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toContain('hr-review-turnaround.csv');
    expect(getHrReviewTurnaroundReportMock).toHaveBeenCalledWith({ from: '2026-01-01', to: '2026-01-31', query: 'jane' });
    expect(body).toContain('Jane Doe');
    expect(body).toContain('2.0');
  });

  it('allows an admin and an auditor too', async () => {
    for (const role of ['admin', 'auditor']) {
      getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role } });
      const response = await GET(new Request('http://x/reports/hr-turnaround/export'));
      expect(response.status).toBe(200);
    }
  });
});
