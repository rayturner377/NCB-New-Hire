import { beforeEach, describe, expect, it, vi } from 'vitest';

const listCasesWithPatientMock = vi.fn();

vi.mock('../../../../cases/services/cases-service', () => ({
  listCasesWithPatient: (...args: unknown[]) => listCasesWithPatientMock(...args)
}));

const { getHrReviewTurnaroundReport } = await import('../../hr-turnaround-report-service');

function caseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case_1',
    status: 'reviewed',
    doctorSubmittedAt: new Date('2026-01-01T00:00:00.000Z'),
    reviewedAt: new Date('2026-01-04T00:00:00.000Z'),
    patient: { id: 'pat_1', fullName: 'Jane Doe', employeeId: 'EMP-1' },
    ...overrides
  };
}

describe('getHrReviewTurnaroundReport', () => {
  beforeEach(() => {
    listCasesWithPatientMock.mockReset();
  });

  it('computes turnaround days as reviewedAt - doctorSubmittedAt', async () => {
    listCasesWithPatientMock.mockResolvedValue([caseRow()]);

    const result = await getHrReviewTurnaroundReport();

    expect(result.casesReviewed).toBe(1);
    expect(result.rows[0]).toMatchObject({ id: 'case_1', patientFullName: 'Jane Doe', turnaroundDays: 3 });
    expect(result.averageDays).toBe(3);
    expect(result.minDays).toBe(3);
    expect(result.maxDays).toBe(3);
  });

  it('computes average/min/max across multiple reviewed cases', async () => {
    listCasesWithPatientMock.mockResolvedValue([
      caseRow({ id: 'a', doctorSubmittedAt: new Date('2026-01-01'), reviewedAt: new Date('2026-01-02') }),
      caseRow({ id: 'b', doctorSubmittedAt: new Date('2026-01-01'), reviewedAt: new Date('2026-01-06') })
    ]);

    const result = await getHrReviewTurnaroundReport();

    expect(result.minDays).toBe(1);
    expect(result.maxDays).toBe(5);
    expect(result.averageDays).toBe(3);
  });

  it('includes an archived case (also a closed, reviewed state)', async () => {
    listCasesWithPatientMock.mockResolvedValue([caseRow({ status: 'archived' })]);

    const result = await getHrReviewTurnaroundReport();

    expect(result.casesReviewed).toBe(1);
  });

  it('excludes a case still awaiting review (no reviewedAt)', async () => {
    listCasesWithPatientMock.mockResolvedValue([caseRow({ status: 'doctor_submitted', reviewedAt: null })]);

    const result = await getHrReviewTurnaroundReport();

    expect(result.casesReviewed).toBe(0);
    expect(result.averageDays).toBe(0);
  });

  it('excludes a reviewed case missing doctorSubmittedAt rather than computing a bogus duration', async () => {
    listCasesWithPatientMock.mockResolvedValue([caseRow({ doctorSubmittedAt: null })]);

    const result = await getHrReviewTurnaroundReport();

    expect(result.casesReviewed).toBe(0);
  });

  it('excludes a cancelled/withdrawn case (never reaches reviewed/archived status)', async () => {
    listCasesWithPatientMock.mockResolvedValue([caseRow({ status: 'withdrawn' })]);

    const result = await getHrReviewTurnaroundReport();

    expect(result.casesReviewed).toBe(0);
  });

  it('filters by reviewedAt date range', async () => {
    listCasesWithPatientMock.mockResolvedValue([
      caseRow({ id: 'in-range', reviewedAt: new Date('2026-02-15') }),
      caseRow({ id: 'out-of-range', reviewedAt: new Date('2026-03-15') })
    ]);

    const result = await getHrReviewTurnaroundReport({ from: '2026-02-01', to: '2026-02-28' });

    expect(result.rows.map((row) => row.id)).toEqual(['in-range']);
  });

  it('filters by patient name, case-insensitive substring', async () => {
    listCasesWithPatientMock.mockResolvedValue([
      caseRow({ id: 'match', patient: { id: 'p1', fullName: 'Jane Doe', employeeId: null } }),
      caseRow({ id: 'no-match', patient: { id: 'p2', fullName: 'John Smith', employeeId: null } })
    ]);

    const result = await getHrReviewTurnaroundReport({ query: 'jane' });

    expect(result.rows.map((row) => row.id)).toEqual(['match']);
  });

  it('sorts rows by reviewedAt descending', async () => {
    listCasesWithPatientMock.mockResolvedValue([
      caseRow({ id: 'older', reviewedAt: new Date('2026-01-02') }),
      caseRow({ id: 'newer', reviewedAt: new Date('2026-01-10') })
    ]);

    const result = await getHrReviewTurnaroundReport();

    expect(result.rows.map((row) => row.id)).toEqual(['newer', 'older']);
  });

  it('returns zeroed stats with no rows when nothing has been reviewed', async () => {
    listCasesWithPatientMock.mockResolvedValue([]);

    const result = await getHrReviewTurnaroundReport();

    expect(result).toEqual({ casesReviewed: 0, averageDays: 0, minDays: 0, maxDays: 0, rows: [] });
  });
});
