import { beforeEach, describe, expect, it, vi } from 'vitest';

const listForClinician = vi.fn();

vi.mock('@ncb/database', () => ({
  casesRepository: {
    listForClinician: (...args: unknown[]) => listForClinician(...args)
  }
}));

const masterKey = Buffer.alloc(32);
vi.mock('../../../../../../lib/master-key', () => ({ loadMasterKey: () => masterKey }));

const { getDoctorDashboardData } = await import('../../doctor-dashboard-service');

function caseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case_1',
    status: 'sent_to_doctor',
    assignedAt: new Date('2026-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    doctorSubmittedAt: null,
    patient: { id: 'pat_1', fullName: 'Jane Doe', employeeId: 'EMP-1' },
    ...overrides
  };
}

describe('getDoctorDashboardData', () => {
  beforeEach(() => {
    listForClinician.mockReset();
  });

  it('scopes the query to the given clinician', async () => {
    listForClinician.mockResolvedValue([]);

    await getDoctorDashboardData('usr_doctor_demo');

    expect(listForClinician).toHaveBeenCalledWith('usr_doctor_demo', masterKey);
  });

  it('counts new cases as those still sitting at sent_to_doctor', async () => {
    listForClinician.mockResolvedValue([
      caseRow({ id: 'a', status: 'sent_to_doctor' }),
      caseRow({ id: 'b', status: 'reviewed' })
    ]);

    const result = await getDoctorDashboardData('usr_doctor_demo');

    expect(result.newCases).toBe(1);
    expect(result.inbox).toHaveLength(1);
    expect(result.inbox[0]?.id).toBe('a');
  });

  it('excludes a case a reviewer has hidden from the doctor\'s inbox', async () => {
    listForClinician.mockResolvedValue([
      caseRow({ id: 'a', status: 'sent_to_doctor' }),
      caseRow({ id: 'b', status: 'sent_to_doctor', payload: { hidden: true } })
    ]);

    const result = await getDoctorDashboardData('usr_doctor_demo');

    expect(result.inbox.map((row) => row.id)).toEqual(['a']);
    expect(result.newCases).toBe(1);
  });

  it('counts doctor_submitted and review_pending as submitted for HR review', async () => {
    listForClinician.mockResolvedValue([
      caseRow({ id: 'a', status: 'doctor_submitted' }),
      caseRow({ id: 'b', status: 'review_pending' }),
      caseRow({ id: 'c', status: 'reviewed' })
    ]);

    const result = await getDoctorDashboardData('usr_doctor_demo');

    expect(result.submittedForHrReview).toBe(2);
  });

  it('counts cases doctor-submitted in the current month', async () => {
    const now = new Date();
    const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));

    listForClinician.mockResolvedValue([
      caseRow({ id: 'a', status: 'reviewed', doctorSubmittedAt: thisMonth }),
      caseRow({ id: 'b', status: 'reviewed', doctorSubmittedAt: lastMonth }),
      caseRow({ id: 'c', status: 'sent_to_doctor', doctorSubmittedAt: null })
    ]);

    const result = await getDoctorDashboardData('usr_doctor_demo');

    expect(result.processedThisMonth).toBe(1);
  });

  it('history excludes the live inbox and includes everything the doctor has already acted on', async () => {
    listForClinician.mockResolvedValue([
      caseRow({ id: 'a', status: 'sent_to_doctor' }),
      caseRow({ id: 'b', status: 'doctor_submitted' }),
      caseRow({ id: 'c', status: 'reviewed' })
    ]);

    const result = await getDoctorDashboardData('usr_doctor_demo');

    expect(result.history.map((row) => row.id)).toEqual(['b', 'c']);
  });

  it('history filters by status and by createdAt date range', async () => {
    listForClinician.mockResolvedValue([
      caseRow({ id: 'a', status: 'reviewed', createdAt: new Date('2026-01-05') }),
      caseRow({ id: 'b', status: 'doctor_submitted', createdAt: new Date('2026-02-10') }),
      caseRow({ id: 'c', status: 'reviewed', createdAt: new Date('2026-03-01') })
    ]);

    const byStatus = await getDoctorDashboardData('usr_doctor_demo', { status: 'reviewed' });
    expect(byStatus.history.map((row) => row.id).sort()).toEqual(['a', 'c']);

    const byRange = await getDoctorDashboardData('usr_doctor_demo', { from: '2026-02-01', to: '2026-02-28' });
    expect(byRange.history.map((row) => row.id)).toEqual(['b']);
  });
});
