import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

const getSessionMock = vi.fn();
const searchAllCasesWithPatientMock = vi.fn();

vi.mock('../../../../lib/session', () => ({
  getSession: (...args: unknown[]) => getSessionMock(...args)
}));
vi.mock('../../../../features/cases/services/cases-service', () => ({
  searchAllCasesWithPatient: (...args: unknown[]) => searchAllCasesWithPatientMock(...args)
}));

const { GET } = await import('./route');

const sampleCase = {
  id: 'case_1',
  status: 'reviewed',
  route: 'patient',
  payload: { caseType: 'pre_employment' },
  updatedAt: new Date('2026-01-05T00:00:00.000Z'),
  patient: { id: 'pat_1', fullName: 'Jane Doe', employeeId: 'EMP-1' }
};

describe('GET /cases/export', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    searchAllCasesWithPatientMock.mockReset();
    searchAllCasesWithPatientMock.mockResolvedValue([sampleCase]);
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await GET(new Request('http://x/cases/export'));

    expect(response.status).toBe(401);
  });

  it.each(['patient', 'clinician', 'delegate'])('rejects a %s (this is the staff-wide case list, not a scoped one)', async (role) => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1', role } });

    const response = await GET(new Request('http://x/cases/export'));

    expect(response.status).toBe(404);
    expect(searchAllCasesWithPatientMock).not.toHaveBeenCalled();
  });

  it('returns CSV by default for a reviewer, passing filters through', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer', role: 'reviewer' } });

    const response = await GET(new Request('http://x/cases/export?status=reviewed&query=jane'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/csv');
    expect(response.headers.get('Content-Disposition')).toContain('all-cases.csv');
    expect(searchAllCasesWithPatientMock).toHaveBeenCalledWith({ query: 'jane', status: 'reviewed', billing: '', from: '', to: '' });
    expect(body).toContain('Jane Doe');
    expect(body).toContain('EMP-1');
  });

  it('returns a real .xlsx workbook when format=xlsx is requested', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin', role: 'admin' } });

    const response = await GET(new Request('http://x/cases/export?format=xlsx'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(response.headers.get('Content-Disposition')).toContain('all-cases.xlsx');
    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.byteLength).toBeGreaterThan(0);
    // .xlsx is a zip container — its first two bytes are always "PK".
    expect(buffer.subarray(0, 2).toString()).toBe('PK');
  });

  it('allows an auditor too (read-only, but still MEDICAL_CASES_LIST-holding staff)', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_auditor', role: 'auditor' } });

    const response = await GET(new Request('http://x/cases/export'));

    expect(response.status).toBe(200);
  });
});
