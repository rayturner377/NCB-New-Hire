import { beforeEach, describe, expect, it, vi } from 'vitest';

const findByEmail = vi.fn();
const create = vi.fn();
const listUsersMock = vi.fn();
const setActive = vi.fn();
const updateMock = vi.fn();
const auditAppend = vi.fn();
const sendNotificationMock = vi.fn();
const setUserPasswordMock = vi.fn();
const revokeAllSessionsForUserMock = vi.fn();

vi.mock('../../../../notifications/services/notification-service', () => ({
  sendNotification: (...args: unknown[]) => sendNotificationMock(...args)
}));

vi.mock('@ncb/database', () => ({
  usersRepository: {
    findByEmail: (...args: unknown[]) => findByEmail(...args),
    create: (...args: unknown[]) => create(...args),
    listUsers: (...args: unknown[]) => listUsersMock(...args),
    setActive: (...args: unknown[]) => setActive(...args),
    update: (...args: unknown[]) => updateMock(...args)
  },
  auditRepository: {
    append: (...args: unknown[]) => auditAppend(...args)
  }
}));

vi.mock('@ncb/auth/utils', () => ({
  setUserPassword: (...args: unknown[]) => setUserPasswordMock(...args),
  revokeAllSessionsForUser: (...args: unknown[]) => revokeAllSessionsForUserMock(...args)
}));

const { createUser, DuplicateEmailError, listUsers, setUserActive, changePassword, resetUserPassword } = await import('../../users-service');

function sampleUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'usr_1',
    email: 'reviewer@ncb.local',
    displayName: 'Demo Reviewer',
    role: 'reviewer',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides
  };
}

describe('users service', () => {
  beforeEach(() => {
    findByEmail.mockReset();
    create.mockReset();
    listUsersMock.mockReset();
    setActive.mockReset();
    updateMock.mockReset();
    updateMock.mockResolvedValue(sampleUser());
    auditAppend.mockReset();
    sendNotificationMock.mockReset();
    setUserPasswordMock.mockReset();
    revokeAllSessionsForUserMock.mockReset();
  });

  it('createUser rejects a duplicate email without calling create', async () => {
    findByEmail.mockResolvedValue(sampleUser());

    await expect(
      createUser({ email: 'reviewer@ncb.local', displayName: 'Someone Else', role: 'reviewer', password: 'a-very-long-password' })
    ).rejects.toThrow(DuplicateEmailError);
    expect(create).not.toHaveBeenCalled();
  });

  it('createUser persists a new user, sets its Better Auth password, and returns a summary without the password record', async () => {
    findByEmail.mockResolvedValue(null);
    create.mockResolvedValue(sampleUser());

    const result = await createUser({
      email: 'Reviewer@NCB.local',
      displayName: 'Demo Reviewer',
      role: 'reviewer',
      password: 'a-very-long-password'
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'reviewer@ncb.local', role: 'reviewer' })
    );
    expect(setUserPasswordMock).toHaveBeenCalledWith('usr_1', 'a-very-long-password');
    expect(result).not.toHaveProperty('passwordRecord');
    expect(result.id).toBe('usr_1');
  });

  it('listUsers maps repository rows to summaries', async () => {
    listUsersMock.mockResolvedValue([sampleUser()]);

    const result = await listUsers();

    expect(result).toEqual([
      {
        id: 'usr_1',
        email: 'reviewer@ncb.local',
        displayName: 'Demo Reviewer',
        role: 'reviewer',
        active: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        medicalProfile: {},
        permissionOverrides: { grant: [], revoke: [] }
      }
    ]);
  });

  it('setUserActive toggles active state', async () => {
    setActive.mockResolvedValue(sampleUser({ active: false }));

    const result = await setUserActive('usr_1', false);

    expect(setActive).toHaveBeenCalledWith('usr_1', false);
    expect(result.active).toBe(false);
  });

  it('changePassword clears mustChangePassword and sets the new Better Auth password', async () => {
    await changePassword('usr_1', 'a-new-long-password');

    expect(updateMock).toHaveBeenCalledWith('usr_1', { mustChangePassword: false });
    expect(setUserPasswordMock).toHaveBeenCalledWith('usr_1', 'a-new-long-password');
    // Other-session revocation is the caller's job now (it needs the
    // request's own headers to know which session is "current" — see
    // features/auth/actions/change-password.ts), not this service function's.
    expect(revokeAllSessionsForUserMock).not.toHaveBeenCalled();
  });

  it('resetUserPassword sets the new password and kills every session on the target account unconditionally', async () => {
    await resetUserPassword('usr_1', 'a-new-long-password', true, 'usr_admin_demo');

    expect(updateMock).toHaveBeenCalledWith('usr_1', { mustChangePassword: true });
    expect(setUserPasswordMock).toHaveBeenCalledWith('usr_1', 'a-new-long-password');
    expect(revokeAllSessionsForUserMock).toHaveBeenCalledWith('usr_1');
    expect(auditAppend).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'user_password_reset', entityId: 'usr_1' }));
  });
});
