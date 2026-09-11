import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
const listUsersMock = vi.fn();
const listCasesWithPatientMock = vi.fn();

vi.mock('@ncb/database', () => ({
  auditRepository: { query: (...args: unknown[]) => queryMock(...args) }
}));
vi.mock('../../../../users/services/users-service', () => ({
  listUsers: (...args: unknown[]) => listUsersMock(...args)
}));
vi.mock('../../../../cases/services/cases-service', () => ({
  listCasesWithPatient: (...args: unknown[]) => listCasesWithPatientMock(...args)
}));

const { getAuditLog } = await import('../../audit-log-service');

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt_1',
    occurredAt: new Date('2026-01-01T12:00:00.000Z'),
    eventType: 'login_success',
    actorUserId: null,
    entityType: null,
    entityId: null,
    details: {},
    ...overrides
  };
}

describe('getAuditLog', () => {
  beforeEach(() => {
    queryMock.mockReset();
    listUsersMock.mockReset();
    listCasesWithPatientMock.mockReset();
    listUsersMock.mockResolvedValue([{ id: 'usr_1', displayName: 'Demo Reviewer', role: 'reviewer' }]);
    listCasesWithPatientMock.mockResolvedValue([{ id: 'case_1', patient: { fullName: 'Jane Doe' } }]);
  });

  it('passes date-range filters through as UTC day boundaries', async () => {
    queryMock.mockResolvedValue({ rows: [], total: 0 });

    await getAuditLog({ from: '2026-01-01', to: '2026-01-31', eventTypes: ['login_success'] }, 2, 25);

    expect(queryMock).toHaveBeenCalledWith(
      {
        eventTypes: ['login_success'],
        entityType: undefined,
        from: new Date('2026-01-01T00:00:00.000Z'),
        to: new Date('2026-01-31T23:59:59.999Z')
      },
      2,
      25
    );
  });

  it('labels a known actor by their real name/role, and an unauthenticated event as System', async () => {
    queryMock.mockResolvedValue({
      rows: [
        baseEvent({ actorUserId: 'usr_1' }),
        baseEvent({ id: 'evt_2', actorUserId: null })
      ],
      total: 2
    });

    const { rows } = await getAuditLog({}, 1, 20);

    expect(rows[0]).toMatchObject({ actorName: 'Demo Reviewer', actorRole: 'Reviewer' });
    expect(rows[1]).toMatchObject({ actorName: 'System', actorRole: '—' });
  });

  it('falls back to "Unknown user" when the actor id no longer resolves to a real user', async () => {
    queryMock.mockResolvedValue({ rows: [baseEvent({ actorUserId: 'usr_deleted' })], total: 1 });

    const { rows } = await getAuditLog({}, 1, 20);

    expect(rows[0]!.actorName).toBe('Unknown user');
  });

  describe('case events', () => {
    it('formats a case_transition event with a from/to status arrow', async () => {
      queryMock.mockResolvedValue({
        rows: [
          baseEvent({
            eventType: 'case_transition',
            entityType: 'case',
            entityId: 'case_1',
            details: { from: 'sent_to_doctor', to: 'reviewed' }
          })
        ],
        total: 1
      });

      const { rows } = await getAuditLog({}, 1, 20);

      expect(rows[0]!.entityKind).toBe('Patient case');
      expect(rows[0]!.entityLabel).toBe('Jane Doe');
      expect(rows[0]!.href).toBe('/cases/case_1');
      expect(rows[0]!.detail).toContain('→');
    });

    it('treats a missing "from" on case_transition as starting from the beginning', async () => {
      queryMock.mockResolvedValue({
        rows: [baseEvent({ eventType: 'case_transition', entityType: 'case', entityId: 'case_1', details: { to: 'submitted' } })],
        total: 1
      });

      const { rows } = await getAuditLog({}, 1, 20);

      expect(rows[0]!.detail).toMatch(/^the start →/);
    });

    it('formats a case_reassigned event with doctor display names', async () => {
      listUsersMock.mockResolvedValue([
        { id: 'usr_1', displayName: 'Demo Reviewer', role: 'reviewer' },
        { id: 'doc_1', displayName: 'Dr. Old', role: 'clinician' },
        { id: 'doc_2', displayName: 'Dr. New', role: 'clinician' }
      ]);
      queryMock.mockResolvedValue({
        rows: [
          baseEvent({
            eventType: 'case_reassigned',
            entityType: 'case',
            entityId: 'case_1',
            details: { from: 'doc_1', to: 'doc_2' }
          })
        ],
        total: 1
      });

      const { rows } = await getAuditLog({}, 1, 20);

      expect(rows[0]!.detail).toBe('Dr. Old → Dr. New');
    });

    it('formats a case_reassigned event with no prior doctor as Unassigned', async () => {
      queryMock.mockResolvedValue({
        rows: [baseEvent({ eventType: 'case_reassigned', entityType: 'case', entityId: 'case_1', details: { to: 'usr_1' } })],
        total: 1
      });

      const { rows } = await getAuditLog({}, 1, 20);

      expect(rows[0]!.detail).toMatch(/^Unassigned →/);
    });

    it('formats a case_payment_confirmed event with a paid-on date when present', async () => {
      queryMock.mockResolvedValue({
        rows: [
          baseEvent({
            eventType: 'case_payment_confirmed',
            entityType: 'case',
            entityId: 'case_1',
            details: { paidOn: '2026-02-01' }
          })
        ],
        total: 1
      });

      const { rows } = await getAuditLog({}, 1, 20);

      expect(rows[0]!.detail).toBe('Paid on 2026-02-01');
    });

    it('labels a case whose id no longer resolves as a deleted case with no link', async () => {
      queryMock.mockResolvedValue({
        rows: [baseEvent({ eventType: 'case_transition', entityType: 'case', entityId: 'case_gone', details: {} })],
        total: 1
      });

      const { rows } = await getAuditLog({}, 1, 20);

      expect(rows[0]!.entityLabel).toBe('Deleted case');
      expect(rows[0]!.href).toBeNull();
    });
  });

  describe('user events', () => {
    it('formats a user event for a still-existing target user, linking to their role list page', async () => {
      queryMock.mockResolvedValue({
        rows: [baseEvent({ eventType: 'user_created', entityType: 'user', entityId: 'usr_1' })],
        total: 1
      });

      const { rows } = await getAuditLog({}, 1, 20);

      expect(rows[0]!.entityKind).toBe('User account');
      expect(rows[0]!.entityLabel).toBe('Demo Reviewer');
      expect(rows[0]!.href).toBe('/reviewers');
      expect(rows[0]!.detail).toBe('Reviewer');
    });

    it('falls back to the audit details snapshot when the target user was later deleted', async () => {
      queryMock.mockResolvedValue({
        rows: [
          baseEvent({
            eventType: 'user_deleted',
            entityType: 'user',
            entityId: 'usr_gone',
            details: { displayName: 'Former Employee', role: 'clinician' }
          })
        ],
        total: 1
      });

      const { rows } = await getAuditLog({}, 1, 20);

      expect(rows[0]!.entityLabel).toBe('Former Employee');
      expect(rows[0]!.href).toBeNull();
      expect(rows[0]!.detail).toBe('Doctor');
    });
  });

  it('formats a settings event', async () => {
    queryMock.mockResolvedValue({
      rows: [baseEvent({ eventType: 'settings_updated', entityType: 'settings', entityId: null })],
      total: 1
    });

    const { rows } = await getAuditLog({}, 1, 20);

    expect(rows[0]!.entityKind).toBe('System settings');
    expect(rows[0]!.entityLabel).toBe('Settings');
    expect(rows[0]!.href).toBe('/settings');
  });

  it('formats a route (access-denied) event with the attempted permission as detail', async () => {
    queryMock.mockResolvedValue({
      rows: [baseEvent({ eventType: 'access_denied', entityType: 'route', entityId: '/settings', details: { permission: 'settings:manage' } })],
      total: 1
    });

    const { rows } = await getAuditLog({}, 1, 20);

    expect(rows[0]!.entityKind).toBe('Route');
    expect(rows[0]!.entityLabel).toBe('/settings');
    expect(rows[0]!.detail).toBe('settings:manage');
  });

  it('falls back to a blank entity for any unrecognized entityType', async () => {
    queryMock.mockResolvedValue({ rows: [baseEvent({ entityType: 'something_new' })], total: 1 });

    const { rows } = await getAuditLog({}, 1, 20);

    expect(rows[0]!.entityKind).toBe('—');
    expect(rows[0]!.entityLabel).toBe('—');
  });
});
