import { beforeEach, describe, expect, it, vi } from 'vitest';

const listForClinician = vi.fn();
const listAllWithPatient = vi.fn();
const listUsersMock = vi.fn();

vi.mock('@ncb/database', () => ({
  casesRepository: {
    listForClinician: (...args: unknown[]) => listForClinician(...args),
    listAllWithPatient: (...args: unknown[]) => listAllWithPatient(...args)
  }
}));

const masterKey = Buffer.alloc(32);
vi.mock('../../../../../lib/master-key', () => ({ loadMasterKey: () => masterKey }));
vi.mock('../../../../users/services/users-service', () => ({ listUsers: (...args: unknown[]) => listUsersMock(...args) }));

const { getDoctorBillingReport, getOrganizationBillingReport } = await import('../../billing-report-service');

function caseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case_1',
    status: 'doctor_submitted',
    paymentStatus: 'unpaid',
    payableAmount: 150,
    createdAt: new Date('2026-01-15'),
    doctorSubmittedAt: new Date('2026-01-15'),
    payload: { positionAppliedFor: 'Teller' },
    patient: { id: 'pat_1', fullName: 'Jane Doe', employeeId: 'EMP-1' },
    ...overrides
  };
}

describe('getDoctorBillingReport', () => {
  beforeEach(() => {
    listForClinician.mockReset();
    listAllWithPatient.mockReset();
    listUsersMock.mockReset();
  });

  it('still includes a submitted case with no payableAmount captured yet — it should show up as outstanding, not vanish', async () => {
    listForClinician.mockResolvedValue([caseRow({ id: 'a', payableAmount: null }), caseRow({ id: 'b', payableAmount: 100 })]);

    const result = await getDoctorBillingReport('usr_doctor_demo');

    expect(result.rows.map((row) => row.id).sort()).toEqual(['a', 'b']);
    expect(result.casesProcessed).toBe(2);
    expect(result.outstandingTotal).toBe(100);
  });

  it('excludes a case that has not reached the doctor yet', async () => {
    listForClinician.mockResolvedValue([caseRow({ id: 'a', status: 'sent_to_doctor', payableAmount: null })]);

    const result = await getDoctorBillingReport('usr_doctor_demo');

    expect(result.rows).toEqual([]);
    expect(result.casesProcessed).toBe(0);
  });

  it('sums paid vs outstanding separately, and drops a canceled case from the report entirely', async () => {
    listForClinician.mockResolvedValue([
      caseRow({ id: 'a', status: 'reviewed', paymentStatus: 'paid', payableAmount: 100 }),
      caseRow({ id: 'b', status: 'doctor_submitted', paymentStatus: 'unpaid', payableAmount: 50 }),
      caseRow({ id: 'c', status: 'canceled_by_doctor', paymentStatus: 'unpaid', payableAmount: 75 })
    ]);

    const result = await getDoctorBillingReport('usr_doctor_demo');

    expect(result.paidTotal).toBe(100);
    expect(result.outstandingTotal).toBe(50);
    expect(result.casesProcessed).toBe(2);
    expect(result.rows.map((row) => row.id).sort()).toEqual(['a', 'b']);
  });

  it('the billing filter narrows the row list but not the stat totals', async () => {
    listForClinician.mockResolvedValue([
      caseRow({ id: 'a', status: 'reviewed', paymentStatus: 'paid', payableAmount: 100 }),
      caseRow({ id: 'b', status: 'doctor_submitted', paymentStatus: 'unpaid', payableAmount: 50 })
    ]);

    const result = await getDoctorBillingReport('usr_doctor_demo', { billing: 'paid' });

    expect(result.rows.map((row) => row.id)).toEqual(['a']);
    expect(result.paidTotal).toBe(100);
    expect(result.outstandingTotal).toBe(50);
  });

  it('filters by createdAt date range', async () => {
    listForClinician.mockResolvedValue([
      caseRow({ id: 'a', createdAt: new Date('2026-01-05'), payableAmount: 100 }),
      caseRow({ id: 'b', createdAt: new Date('2026-02-15'), payableAmount: 200 })
    ]);

    const result = await getDoctorBillingReport('usr_doctor_demo', { from: '2026-02-01', to: '2026-02-28' });

    expect(result.rows.map((row) => row.id)).toEqual(['b']);
    expect(result.casesProcessed).toBe(1);
  });

  it('filters by candidate name (case-insensitive)', async () => {
    listForClinician.mockResolvedValue([
      caseRow({ id: 'a', patient: { id: 'p1', fullName: 'Jane Doe' } }),
      caseRow({ id: 'b', patient: { id: 'p2', fullName: 'John Smith' } })
    ]);

    const result = await getDoctorBillingReport('usr_doctor_demo', { query: 'jane' });

    expect(result.rows.map((row) => row.id)).toEqual(['a']);
  });
});

describe('getOrganizationBillingReport', () => {
  beforeEach(() => {
    listForClinician.mockReset();
    listAllWithPatient.mockReset();
    listUsersMock.mockReset();
  });

  function orgCaseRow(overrides: Record<string, unknown> = {}) {
    return caseRow(overrides);
  }

  it('groups billed cases by doctor when no clinicianId is given', async () => {
    listAllWithPatient.mockResolvedValue([
      orgCaseRow({ id: 'a', status: 'reviewed', paymentStatus: 'paid', payableAmount: 100, assignedClinicianId: 'doc_1' }),
      orgCaseRow({ id: 'b', status: 'doctor_submitted', paymentStatus: 'unpaid', payableAmount: 50, assignedClinicianId: 'doc_1' }),
      orgCaseRow({ id: 'c', status: 'reviewed', paymentStatus: 'paid', payableAmount: 200, assignedClinicianId: 'doc_2' })
    ]);
    listUsersMock.mockResolvedValue([
      { id: 'doc_1', displayName: 'Dr. One', role: 'clinician' },
      { id: 'doc_2', displayName: 'Dr. Two', role: 'clinician' }
    ]);

    const result = await getOrganizationBillingReport();

    expect(result.paidTotal).toBe(300);
    expect(result.outstandingTotal).toBe(50);
    expect(result.byDoctor).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ clinicianId: 'doc_1', paidTotal: 100, outstandingTotal: 50, casesProcessed: 2 }),
        expect.objectContaining({ clinicianId: 'doc_2', paidTotal: 200, outstandingTotal: 0, casesProcessed: 1 })
      ])
    );
    expect(result.rows).toBeUndefined();
  });

  it('the billing filter narrows the by-doctor summary too, not just the drill-down rows — a doctor with nothing matching drops out entirely', async () => {
    listAllWithPatient.mockResolvedValue([
      orgCaseRow({ id: 'a', status: 'doctor_submitted', paymentStatus: 'unpaid', payableAmount: 50, assignedClinicianId: 'doc_1' }),
      orgCaseRow({ id: 'b', status: 'reviewed', paymentStatus: 'paid', payableAmount: 200, assignedClinicianId: 'doc_2' })
    ]);
    listUsersMock.mockResolvedValue([
      { id: 'doc_1', displayName: 'Dr. One', role: 'clinician' },
      { id: 'doc_2', displayName: 'Dr. Two', role: 'clinician' }
    ]);

    const paidOnly = await getOrganizationBillingReport({ billing: 'paid' });
    expect(paidOnly.byDoctor).toEqual([expect.objectContaining({ clinicianId: 'doc_2', paidTotal: 200, outstandingTotal: 0, casesProcessed: 1 })]);
    // Headline totals stay unfiltered regardless — same convention as the drill-down's own rows.
    expect(paidOnly.paidTotal).toBe(200);
    expect(paidOnly.outstandingTotal).toBe(50);

    const unpaidOnly = await getOrganizationBillingReport({ billing: 'unpaid' });
    expect(unpaidOnly.byDoctor).toEqual([expect.objectContaining({ clinicianId: 'doc_1', paidTotal: 0, outstandingTotal: 50, casesProcessed: 1 })]);
  });

  it('drills into one doctor\'s case-level rows when clinicianId is given', async () => {
    listAllWithPatient.mockResolvedValue([
      orgCaseRow({ id: 'a', payableAmount: 100, assignedClinicianId: 'doc_1' }),
      orgCaseRow({ id: 'b', payableAmount: 200, assignedClinicianId: 'doc_2' })
    ]);
    listUsersMock.mockResolvedValue([{ id: 'doc_1', displayName: 'Dr. One', role: 'clinician' }]);

    const result = await getOrganizationBillingReport({ clinicianId: 'doc_1' });

    expect(result.rows?.map((row) => row.id)).toEqual(['a']);
    expect(result.byDoctor).toBeUndefined();
  });

  it('date-filters by doctorSubmittedAt, not createdAt — a case created in one period but billed in another belongs to the billed one', async () => {
    listAllWithPatient.mockResolvedValue([
      orgCaseRow({
        id: 'a',
        assignedClinicianId: 'doc_1',
        createdAt: new Date('2025-09-01'), // created in FY25
        doctorSubmittedAt: new Date('2025-10-15') // but billed just into FY26
      })
    ]);
    listUsersMock.mockResolvedValue([{ id: 'doc_1', displayName: 'Dr. One', role: 'clinician' }]);

    const fy25 = await getOrganizationBillingReport({ from: '2024-10-01', to: '2025-09-30' });
    const fy26 = await getOrganizationBillingReport({ from: '2025-10-01', to: '2026-09-30' });

    expect(fy25.casesProcessed).toBe(0);
    expect(fy26.casesProcessed).toBe(1);
  });

  it('exposes the available financial years spanning the earliest billed case through the current one', async () => {
    listAllWithPatient.mockResolvedValue([
      orgCaseRow({ id: 'a', assignedClinicianId: 'doc_1', doctorSubmittedAt: new Date('2023-01-15'), payableAmount: 100 })
    ]);
    listUsersMock.mockResolvedValue([{ id: 'doc_1', displayName: 'Dr. One', role: 'clinician' }]);

    const result = await getOrganizationBillingReport();

    expect(result.availableFinancialYears).toContain('FY23');
  });

  it('ignores cases with no assigned clinician', async () => {
    listAllWithPatient.mockResolvedValue([orgCaseRow({ id: 'a', payableAmount: 100, assignedClinicianId: null })]);
    listUsersMock.mockResolvedValue([]);

    const result = await getOrganizationBillingReport();

    expect(result.casesProcessed).toBe(0);
    expect(result.byDoctor).toEqual([]);
  });

  it('shows a doctor-submitted case as outstanding even before HR has captured a billed amount', async () => {
    listAllWithPatient.mockResolvedValue([
      orgCaseRow({ id: 'a', status: 'doctor_submitted', paymentStatus: 'unpaid', payableAmount: null, assignedClinicianId: 'doc_1' })
    ]);
    listUsersMock.mockResolvedValue([{ id: 'doc_1', displayName: 'Dr. One', role: 'clinician' }]);

    const result = await getOrganizationBillingReport();

    expect(result.casesProcessed).toBe(1);
    expect(result.byDoctor).toEqual([expect.objectContaining({ clinicianId: 'doc_1', outstandingTotal: 0, casesProcessed: 1 })]);
  });

  it('drops a canceled or withdrawn case from the org report entirely, not just from the totals', async () => {
    listAllWithPatient.mockResolvedValue([
      orgCaseRow({ id: 'a', status: 'canceled_by_doctor', payableAmount: 100, assignedClinicianId: 'doc_1' }),
      orgCaseRow({ id: 'b', status: 'withdrawn', payableAmount: 100, assignedClinicianId: 'doc_1' })
    ]);
    listUsersMock.mockResolvedValue([{ id: 'doc_1', displayName: 'Dr. One', role: 'clinician' }]);

    const result = await getOrganizationBillingReport();

    expect(result.casesProcessed).toBe(0);
    expect(result.byDoctor).toEqual([]);
  });
});
