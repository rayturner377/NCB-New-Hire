import { beforeEach, describe, expect, it, vi } from 'vitest';

const findByEmail = vi.fn();
const create = vi.fn();
const listUsersMock = vi.fn();
const setActive = vi.fn();
const updateMock = vi.fn();
const auditAppend = vi.fn();
const sendNotificationMock = vi.fn();
const deleteAllForUserMock = vi.fn();

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
  },
  sessionsRepository: {
    deleteAllForUser: (...args: unknown[]) => deleteAllForUserMock(...args)
  }
}));

vi.mock('@ncb/shared', () => ({
  makePasswordRecord: (password: string) => ({ alg: 'PBKDF2-SHA256', iterations: 1, salt: 's', hash: password })
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
    deleteAllForUserMock.mockReset();
  });

  it('createUser rejects a duplicate email without calling create', async () => {
    findByEmail.mockResolvedValue(sampleUser());

    await expect(
      createUser({ email: 'reviewer@ncb.local', displayName: 'Someone Else', role: 'reviewer', password: 'a-very-long-password' })
    ).rejects.toThrow(DuplicateEmailError);
    expect(create).not.toHaveBeenCalled();
  });

  it('createUser persists a new user and returns a summary without the password record', async () => {
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

  it('changePassword kills every other session but keeps the caller’s own alive', async () => {
    await changePassword('usr_1', 'a-new-long-password', 'sess_current');

    expect(updateMock).toHaveBeenCalledWith('usr_1', expect.objectContaining({ mustChangePassword: false }));
    expect(deleteAllForUserMock).toHaveBeenCalledWith('usr_1', 'sess_current');
  });

  it('changePassword kills every session (including the caller’s) when no exceptSessionId is given', async () => {
    await changePassword('usr_1', 'a-new-long-password');

    expect(deleteAllForUserMock).toHaveBeenCalledWith('usr_1', undefined);
  });

  it('resetUserPassword kills every session on the target account unconditionally', async () => {
    await resetUserPassword('usr_1', 'a-new-long-password', true, 'usr_admin_demo');

    expect(updateMock).toHaveBeenCalledWith('usr_1', expect.objectContaining({ mustChangePassword: true }));
    expect(deleteAllForUserMock).toHaveBeenCalledWith('usr_1');
    expect(auditAppend).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'user_password_reset', entityId: 'usr_1' }));
  });
});
