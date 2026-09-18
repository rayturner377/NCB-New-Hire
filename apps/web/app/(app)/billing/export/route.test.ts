import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const getDoctorBillingReportMock = vi.fn();
const getOrganizationBillingReportMock = vi.fn();

vi.mock('../../../../lib/session', () => ({
  getSession: (...args: unknown[]) => getSessionMock(...args)
}));
vi.mock('../../../../features/billing/services/billing-report-service', () => ({
  getDoctorBillingReport: (...args: unknown[]) => getDoctorBillingReportMock(...args),
  getOrganizationBillingReport: (...args: unknown[]) => getOrganizationBillingReportMock(...args)
}));

const { GET } = await import('./route');

const sampleRow = {
  id: 'case_1',
  status: 'reviewed',
  billingStatus: 'paid',
  payableAmount: 5000,
  positionAppliedFor: 'Teller',
  patientFullName: 'Jane Doe',
  createdAt: '2026-01-01T00:00:00.000Z',
  doctorSubmittedAt: '2026-01-02T00:00:00.000Z'
};

describe('GET /billing/export', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getDoctorBillingReportMock.mockReset();
    getOrganizationBillingReportMock.mockReset();
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await GET(new Request('http://x/billing/export'));

    expect(response.status).toBe(401);
  });

  it("exports a doctor's own report, ignoring REPORTS_VIEW entirely (identity-scoped, same as the page)", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor', role: 'clinician' } });
    getDoctorBillingReportMock.mockResolvedValue({ rows: [sampleRow] });

    const response = await GET(new Request('http://x/billing/export?billing=paid'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(getDoctorBillingReportMock).toHaveBeenCalledWith('usr_doctor', { billing: 'paid', from: '', to: '', query: '' });
    expect(response.headers.get('Content-Disposition')).toContain('billing-report.csv');
    expect(body).toContain('Jane Doe');
    expect(body).toContain('5000');
    expect(getOrganizationBillingReportMock).not.toHaveBeenCalled();
  });

  it('rejects a role without REPORTS_VIEW that also is not a clinician (e.g. a patient)', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role: 'patient' } });

    const response = await GET(new Request('http://x/billing/export'));

    expect(response.status).toBe(404);
    expect(getOrganizationBillingReportMock).not.toHaveBeenCalled();
  });

  it('exports the per-doctor summary for a reviewer with no doctor drilled into', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer', role: 'reviewer' } });
    getOrganizationBillingReportMock.mockResolvedValue({
      byDoctor: [{ clinicianId: 'doc_1', clinicianName: 'Dr. One', paidTotal: 1000, outstandingTotal: 0, casesProcessed: 1 }]
    });

    const response = await GET(new Request('http://x/billing/export'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toContain('organization-billing-report.csv');
    expect(body).toContain('Dr. One');
    expect(body).toContain('1000');
  });

  it('exports case-level rows for a reviewer drilled into one doctor', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer', role: 'reviewer' } });
    getOrganizationBillingReportMock.mockResolvedValue({ rows: [sampleRow] });

    const response = await GET(new Request('http://x/billing/export?clinicianId=doc_1'));
    const body = await response.text();

    expect(getOrganizationBillingReportMock).toHaveBeenCalledWith({ billing: '', from: '', to: '', query: '', clinicianId: 'doc_1' });
    expect(body).toContain('Jane Doe');
  });

  it('returns a real .xlsx workbook when format=xlsx is requested', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor', role: 'clinician' } });
    getDoctorBillingReportMock.mockResolvedValue({ rows: [sampleRow] });

    const response = await GET(new Request('http://x/billing/export?format=xlsx'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(response.headers.get('Content-Disposition')).toContain('billing-report.xlsx');
    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
  });
});
