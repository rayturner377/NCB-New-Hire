import { beforeEach, describe, expect, it, vi } from 'vitest';

const listCasesWithPatientMock = vi.fn();

vi.mock('../../../../cases/services/cases-service', () => ({
  listCasesWithPatient: (...args: unknown[]) => listCasesWithPatientMock(...args)
}));

const { getCaseTurnaroundReport } = await import('../../turnaround-report-service');

function caseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case_1',
    createdAt: new Date('2025-12-25T00:00:00.000Z'),
    patientSubmittedAt: new Date('2025-12-28T00:00:00.000Z'),
    assignedAt: new Date('2025-12-29T00:00:00.000Z'),
    doctorSubmittedAt: new Date('2026-01-01T00:00:00.000Z'),
    reviewedAt: new Date('2026-01-04T00:00:00.000Z'),
    paymentConfirmedAt: new Date('2026-01-10T00:00:00.000Z'),
    patient: { id: 'pat_1', fullName: 'Jane Doe', employeeId: 'EMP-1' },
    ...overrides
  };
}

describe('getCaseTurnaroundReport', () => {
  beforeEach(() => {
    listCasesWithPatientMock.mockReset();
  });

  it('defaults to doctor-submitted -> HR-reviewed when no milestones are given', async () => {
    listCasesWithPatientMock.mockResolvedValue([caseRow()]);

    const result = await getCaseTurnaroundReport();

    expect(result.fromMilestone).toBe('doctorSubmittedAt');
    expect(result.toMilestone).toBe('reviewedAt');
    expect(result.rows[0]).toMatchObject({ id: 'case_1', turnaroundDays: 3 });
  });

  it('computes turnaround between an arbitrary pair of milestones (case creation -> payment)', async () => {
    listCasesWithPatientMock.mockResolvedValue([caseRow()]);

    const result = await getCaseTurnaroundReport({ fromMilestone: 'createdAt', toMilestone: 'paymentConfirmedAt' });

    expect(result.rows[0]!.turnaroundDays).toBe(16);
  });

  it('computes turnaround between case-reached-doctor and doctor-submitted', async () => {
    listCasesWithPatientMock.mockResolvedValue([caseRow()]);

    const result = await getCaseTurnaroundReport({ fromMilestone: 'assignedAt', toMilestone: 'doctorSubmittedAt' });

    expect(result.rows[0]!.turnaroundDays).toBe(3);
  });

  it('falls back to the defaults for an invalid/unknown milestone key', async () => {
    listCasesWithPatientMock.mockResolvedValue([caseRow()]);

    const result = await getCaseTurnaroundReport({ fromMilestone: 'notARealField', toMilestone: 'alsoNotReal' });

    expect(result.fromMilestone).toBe('doctorSubmittedAt');
    expect(result.toMilestone).toBe('reviewedAt');
  });

  it('excludes a case missing the "from" milestone', async () => {
    listCasesWithPatientMock.mockResolvedValue([caseRow({ assignedAt: null })]);

    const result = await getCaseTurnaroundReport({ fromMilestone: 'assignedAt', toMilestone: 'doctorSubmittedAt' });

    expect(result.casesCounted).toBe(0);
  });

  it('excludes a case missing the "to" milestone (hasn\'t reached it yet)', async () => {
    listCasesWithPatientMock.mockResolvedValue([caseRow({ reviewedAt: null })]);

    const result = await getCaseTurnaroundReport();

    expect(result.casesCounted).toBe(0);
  });

  it('excludes a case where the two timestamps are out of order (data anomaly, not a real negative turnaround)', async () => {
    listCasesWithPatientMock.mockResolvedValue([
      caseRow({ doctorSubmittedAt: new Date('2026-01-05'), reviewedAt: new Date('2026-01-01') })
    ]);

    const result = await getCaseTurnaroundReport();

    expect(result.casesCounted).toBe(0);
  });

  it('includes a case with a zero-day turnaround (same-day milestones)', async () => {
    listCasesWithPatientMock.mockResolvedValue([
      caseRow({ doctorSubmittedAt: new Date('2026-01-01'), reviewedAt: new Date('2026-01-01') })
    ]);

    const result = await getCaseTurnaroundReport();

    expect(result.casesCounted).toBe(1);
    expect(result.rows[0]!.turnaroundDays).toBe(0);
  });

  it('computes average/min/max across multiple cases', async () => {
    listCasesWithPatientMock.mockResolvedValue([
      caseRow({ id: 'a', doctorSubmittedAt: new Date('2026-01-01'), reviewedAt: new Date('2026-01-02') }),
      caseRow({ id: 'b', doctorSubmittedAt: new Date('2026-01-01'), reviewedAt: new Date('2026-01-06') })
    ]);

    const result = await getCaseTurnaroundReport();

    expect(result.minDays).toBe(1);
    expect(result.maxDays).toBe(5);
    expect(result.averageDays).toBe(3);
  });

  it('filters by the "to" milestone\'s date range', async () => {
    listCasesWithPatientMock.mockResolvedValue([
      caseRow({ id: 'in-range', reviewedAt: new Date('2026-02-15') }),
      caseRow({ id: 'out-of-range', reviewedAt: new Date('2026-03-15') })
    ]);

    const result = await getCaseTurnaroundReport({ from: '2026-02-01', to: '2026-02-28' });

    expect(result.rows.map((row) => row.id)).toEqual(['in-range']);
  });

  it('filters by patient name, case-insensitive substring', async () => {
    listCasesWithPatientMock.mockResolvedValue([
      caseRow({ id: 'match', patient: { id: 'p1', fullName: 'Jane Doe', employeeId: null } }),
      caseRow({ id: 'no-match', patient: { id: 'p2', fullName: 'John Smith', employeeId: null } })
    ]);

    const result = await getCaseTurnaroundReport({ query: 'jane' });

    expect(result.rows.map((row) => row.id)).toEqual(['match']);
  });

  it('sorts rows by the "to" date descending', async () => {
    listCasesWithPatientMock.mockResolvedValue([
      caseRow({ id: 'older', reviewedAt: new Date('2026-01-02') }),
      caseRow({ id: 'newer', reviewedAt: new Date('2026-01-10') })
    ]);

    const result = await getCaseTurnaroundReport();

    expect(result.rows.map((row) => row.id)).toEqual(['newer', 'older']);
  });

  it('returns zeroed stats with no rows when nothing matches', async () => {
    listCasesWithPatientMock.mockResolvedValue([]);

    const result = await getCaseTurnaroundReport();

    expect(result).toMatchObject({ casesCounted: 0, averageDays: 0, minDays: 0, maxDays: 0, rows: [] });
  });
});
