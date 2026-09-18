import { beforeEach, describe, expect, it, vi } from 'vitest';

const listAllWithPatient = vi.fn();
const auditList = vi.fn();
const listUsersMock = vi.fn();

vi.mock('@ncb/database', () => ({
  casesRepository: {
    listAllWithPatient: (...args: unknown[]) => listAllWithPatient(...args)
  },
  auditRepository: {
    list: (...args: unknown[]) => auditList(...args)
  }
}));

const masterKey = Buffer.alloc(32);
vi.mock('../../../../../../lib/master-key', () => ({ loadMasterKey: () => masterKey }));
vi.mock('../../../../../users/services/users-service', () => ({ listUsers: (...args: unknown[]) => listUsersMock(...args) }));

const { getReviewerDashboardData } = await import('../../reviewer-dashboard-service');

function caseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case_1',
    status: 'doctor_submitted',
    paymentStatus: 'unpaid',
    payableAmount: 100,
    assignedClinicianId: 'doc_1',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-05'),
    reviewedAt: null,
    doctorSubmittedAt: new Date('2026-01-05'),
    payload: { positionAppliedFor: 'Teller' },
    patient: { id: 'pat_1', fullName: 'Jane Doe', employeeId: 'EMP-1' },
    ...overrides
  };
}

function auditEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    occurredAt: new Date('2026-01-05'),
    actorUserId: 'usr_reviewer_demo',
    eventType: 'case_transition',
    entityType: 'case',
    entityId: 'case_1',
    details: {},
    ...overrides
  };
}

describe('getReviewerDashboardData', () => {
  beforeEach(() => {
    listAllWithPatient.mockReset();
    auditList.mockReset();
    listUsersMock.mockReset();
    listUsersMock.mockResolvedValue([{ id: 'doc_1', displayName: 'Dr. One', role: 'clinician' }, { id: 'usr_reviewer_demo', displayName: 'Nordia Reid', role: 'reviewer' }]);
    auditList.mockResolvedValue([]);
  });

  it('counts snapshot stats by status', async () => {
    listAllWithPatient.mockResolvedValue([
      caseRow({ id: 'a', status: 'sent_to_patient' }),
      caseRow({ id: 'b', status: 'sent_to_doctor' }),
      caseRow({ id: 'c', status: 'doctor_submitted' }),
      caseRow({ id: 'd', status: 'archived' })
    ]);

    const result = await getReviewerDashboardData('2026-01-01', '2026-01-31');

    expect(result.counts).toEqual({ openCases: 3, awaitingPatient: 1, withDoctor: 1, hrReview: 1 });
  });

  it('computes period created/completed/turnaround from the given date range', async () => {
    listAllWithPatient.mockResolvedValue([
      caseRow({ id: 'a', createdAt: new Date('2026-01-10'), status: 'sent_to_doctor' }),
      caseRow({
        id: 'b',
        status: 'reviewed',
        createdAt: new Date('2026-01-01'),
        reviewedAt: new Date('2026-01-06')
      }),
      caseRow({ id: 'c', createdAt: new Date('2025-12-01'), status: 'sent_to_doctor' })
    ]);

    const result = await getReviewerDashboardData('2026-01-01', '2026-01-31');

    expect(result.period.created).toBe(2);
    expect(result.period.completed).toBe(1);
    expect(result.period.averageTurnaroundDays).toBe(5);
  });

  it('sums outstanding billing only for doctor-submitted, non-canceled, unpaid cases', async () => {
    listAllWithPatient.mockResolvedValue([
      caseRow({ id: 'a', status: 'doctor_submitted', paymentStatus: 'unpaid', payableAmount: 100 }),
      caseRow({ id: 'b', status: 'reviewed', paymentStatus: 'paid', payableAmount: 200 }),
      caseRow({ id: 'c', status: 'canceled_by_doctor', paymentStatus: 'unpaid', payableAmount: 300 }),
      caseRow({ id: 'd', status: 'sent_to_doctor', paymentStatus: 'unpaid', payableAmount: 400 })
    ]);

    const result = await getReviewerDashboardData('2026-01-01', '2026-01-31');

    expect(result.billing).toEqual({ count: 1, amount: 100 });
  });

  it('builds the review-queue preview from the same membership rule as listReviewQueueCases, oldest first', async () => {
    listAllWithPatient.mockResolvedValue([
      caseRow({ id: 'a', status: 'doctor_submitted', paymentStatus: 'unpaid', updatedAt: new Date('2026-01-10') }),
      caseRow({ id: 'b', status: 'reviewed', paymentStatus: 'unpaid', updatedAt: new Date('2026-01-05') }),
      caseRow({ id: 'c', status: 'reviewed', paymentStatus: 'paid', updatedAt: new Date('2026-01-01') })
    ]);

    const result = await getReviewerDashboardData('2026-01-01', '2026-01-31');

    expect(result.queueRows.map((row) => row.id)).toEqual(['b', 'a']);
    expect(result.queueRows[0]?.assignedClinicianName).toBe('Dr. One');
  });

  it('labels recent case-related audit events and resolves the actor/case names, ignoring events for entities not among these cases', async () => {
    listAllWithPatient.mockResolvedValue([caseRow({ id: 'case_1' })]);
    auditList.mockResolvedValue([
      auditEvent({ id: 1n, eventType: 'case_transition', entityId: 'case_1' }),
      auditEvent({ id: 2n, eventType: 'login_succeeded', entityType: null, entityId: null }),
      auditEvent({ id: 3n, eventType: 'case_transition', entityId: 'case_missing' })
    ]);

    const result = await getReviewerDashboardData('2026-01-01', '2026-01-31');

    expect(result.recentUpdates).toHaveLength(1);
    expect(result.recentUpdates[0]).toMatchObject({
      action: 'Status change',
      actorName: 'Nordia Reid',
      actorRole: 'Reviewer',
      href: '/cases/case_1?tab=history',
      impactedLabel: 'Jane Doe',
      impactedKind: 'Patient case'
    });
  });

  it('includes user-lifecycle events alongside case events, using details as a fallback once a deleted user drops out of listUsers', async () => {
    listAllWithPatient.mockResolvedValue([caseRow({ id: 'case_1' })]);
    auditList.mockResolvedValue([
      auditEvent({
        id: 4n,
        eventType: 'user_deleted',
        entityType: 'user',
        entityId: 'usr_gone',
        details: { role: 'clinician', displayName: 'Dr. Gone' }
      }),
      auditEvent({ id: 5n, eventType: 'login_success', entityType: null, entityId: null })
    ]);

    const result = await getReviewerDashboardData('2026-01-01', '2026-01-31');

    expect(result.recentUpdates).toHaveLength(1);
    expect(result.recentUpdates[0]).toMatchObject({
      action: 'User deleted',
      impactedLabel: 'Dr. Gone',
      impactedKind: 'User account',
      href: '/audit?type=user_deleted'
    });
  });

  it.each(['case_payment_confirmed', 'case_billing_updated'])('opens billing for %s', async (eventType) => {
    listAllWithPatient.mockResolvedValue([caseRow()]);
    auditList.mockResolvedValue([auditEvent({ eventType })]);
    const result = await getReviewerDashboardData('2026-01-01', '2026-01-31');
    expect(result.recentUpdates[0]?.href).toBe('/cases/case_1?tab=billing');
  });

  it('reports zero average turnaround when no case was completed in range', async () => {
    listAllWithPatient.mockResolvedValue([caseRow({ id: 'a', status: 'sent_to_doctor' })]);

    const result = await getReviewerDashboardData('2026-01-01', '2026-01-31');

    expect(result.period.averageTurnaroundDays).toBe(0);
  });

  it('labels a queue row Unassigned when no clinician is assigned, and falls back to updatedAt when doctorSubmittedAt is missing', async () => {
    listAllWithPatient.mockResolvedValue([
      caseRow({ id: 'a', status: 'doctor_submitted', assignedClinicianId: null, doctorSubmittedAt: null, updatedAt: new Date('2026-01-09') })
    ]);

    const result = await getReviewerDashboardData('2026-01-01', '2026-01-31');

    expect(result.queueRows[0]).toMatchObject({ assignedClinicianName: 'Unassigned', doctorSubmittedAt: '2026-01-09T00:00:00.000Z' });
  });

  it('labels a queue row Unknown doctor when the assigned clinician id no longer resolves to a real user', async () => {
    listAllWithPatient.mockResolvedValue([caseRow({ id: 'a', status: 'doctor_submitted', assignedClinicianId: 'doc_gone' })]);

    const result = await getReviewerDashboardData('2026-01-01', '2026-01-31');

    expect(result.queueRows[0]?.assignedClinicianName).toBe('Unknown doctor');
  });

  it('labels a settings audit event', async () => {
    listAllWithPatient.mockResolvedValue([]);
    auditList.mockResolvedValue([auditEvent({ id: 6n, eventType: 'settings_updated', entityType: 'settings', entityId: null })]);

    const result = await getReviewerDashboardData('2026-01-01', '2026-01-31');

    expect(result.recentUpdates[0]).toMatchObject({ impactedKind: 'System settings', impactedLabel: 'Settings', href: '/settings' });
  });

  it('falls back to a generic row for any other entity type', async () => {
    listAllWithPatient.mockResolvedValue([]);
    auditList.mockResolvedValue([auditEvent({ id: 7n, eventType: 'case_created', entityType: 'something_else', entityId: 'x' })]);

    const result = await getReviewerDashboardData('2026-01-01', '2026-01-31');

    expect(result.recentUpdates[0]).toMatchObject({ impactedKind: '—', impactedLabel: '—', href: '/audit?type=case_created' });
  });

  it('labels an unauthenticated event as System, and an actor whose account is gone as Unknown user', async () => {
    listAllWithPatient.mockResolvedValue([]);
    auditList.mockResolvedValue([
      auditEvent({ id: 8n, eventType: 'settings_updated', entityType: 'settings', entityId: null, actorUserId: null }),
      auditEvent({ id: 9n, eventType: 'settings_updated', entityType: 'settings', entityId: null, actorUserId: 'usr_gone' })
    ]);

    const result = await getReviewerDashboardData('2026-01-01', '2026-01-31');

    expect(result.recentUpdates[0]).toMatchObject({ actorName: 'System', actorRole: '—' });
    expect(result.recentUpdates[1]).toMatchObject({ actorName: 'Unknown user' });
  });
});
