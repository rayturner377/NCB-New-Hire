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
const issueAccessCodeMock = vi.fn();

vi.mock('../../../../notifications/services/notification-service', () => ({
  sendNotification: (...args: unknown[]) => sendNotificationMock(...args)
}));

vi.mock('../../../../auth/services/access-codes-service', () => ({
  issueAccessCode: (...args: unknown[]) => issueAccessCodeMock(...args)
}));

vi.mock('@ncb/database', () => ({
  usersRepository: {
    findByEmail: (...args: unknown[]) => findByEmail(...args),
    create: (...args: unknown[]) => create(...args),
    listUsers: (...args: unknown[]) => listUsersMock(...args),
    setActive: (...args: unknown[]) => setActive(...args),
    update: (...args: unknown[]) => updateMock(...args),
    findById: (...args: unknown[]) => findById(...args),
    softDelete: (...args: unknown[]) => softDelete(...args)
  },
  auditRepository: {
    append: (...args: unknown[]) => auditAppend(...args)
  }
}));

vi.mock('@ncb/auth/utils', () => ({
  setUserPassword: (...args: unknown[]) => setUserPasswordMock(...args),
  revokeAllSessionsForUser: (...args: unknown[]) => revokeAllSessionsForUserMock(...args)
}));

const findById = vi.fn();
const softDelete = vi.fn();

const {
  createUser,
  DuplicateEmailError,
  listUsers,
  listActiveDoctors,
  getUserRole,
  setUserActive,
  updateUser,
  deleteUser,
  changePassword,
  resetUserPassword
} = await import('../../users-service');

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
    issueAccessCodeMock.mockReset();
    issueAccessCodeMock.mockResolvedValue('482913');
    findById.mockReset();
    softDelete.mockReset();
  });

  it('createUser converts a race-condition unique-constraint violation into DuplicateEmailError', async () => {
    findByEmail.mockResolvedValue(null);
    create.mockRejectedValue({ code: 'P2002' });

    await expect(createUser({ email: 'reviewer@ncb.local', displayName: 'Someone', role: 'reviewer' })).rejects.toThrow(
      DuplicateEmailError
    );
    expect(setUserPasswordMock).not.toHaveBeenCalled();
  });

  it('createUser rethrows any other error from create() unchanged', async () => {
    findByEmail.mockResolvedValue(null);
    create.mockRejectedValue(new Error('connection lost'));

    await expect(createUser({ email: 'reviewer@ncb.local', displayName: 'Someone', role: 'reviewer' })).rejects.toThrow(
      'connection lost'
    );
  });

  it('getUserRole returns the role for an existing user', async () => {
    findById.mockResolvedValue(sampleUser({ role: 'admin' }));
    expect(await getUserRole('usr_1')).toBe('admin');
  });

  it('getUserRole returns null when no such user exists', async () => {
    findById.mockResolvedValue(null);
    expect(await getUserRole('missing')).toBeNull();
  });

  it('listActiveDoctors filters to active clinicians only', async () => {
    listUsersMock.mockResolvedValue([
      sampleUser({ id: 'doc_1', role: 'clinician', active: true }),
      sampleUser({ id: 'doc_2', role: 'clinician', active: false }),
      sampleUser({ id: 'usr_3', role: 'reviewer', active: true })
    ]);

    const result = await listActiveDoctors();

    expect(result.map((u) => u.id)).toEqual(['doc_1']);
  });

  it('updateUser passes the patch through and returns a summary', async () => {
    updateMock.mockResolvedValue(sampleUser({ displayName: 'Updated Name' }));

    const result = await updateUser('usr_1', { displayName: 'Updated Name' });

    expect(updateMock).toHaveBeenCalledWith('usr_1', { displayName: 'Updated Name' });
    expect(result.displayName).toBe('Updated Name');
  });

  it('deleteUser soft-deletes and records an audit event with the pre-deletion role/name', async () => {
    softDelete.mockResolvedValue(sampleUser({ role: 'clinician', displayName: 'Departed Doctor' }));

    await deleteUser('usr_1', 'usr_admin_demo');

    expect(softDelete).toHaveBeenCalledWith('usr_1');
    expect(auditAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'user_deleted',
        actorUserId: 'usr_admin_demo',
        entityId: 'usr_1',
        details: { role: 'clinician', displayName: 'Departed Doctor' }
      })
    );
  });

  it('createUser rejects a duplicate email without calling create', async () => {
    findByEmail.mockResolvedValue(sampleUser());

    await expect(createUser({ email: 'reviewer@ncb.local', displayName: 'Someone Else', role: 'reviewer' })).rejects.toThrow(
      DuplicateEmailError
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('createUser persists a new user, sets an unguessable Better Auth password, issues an activation code, and emails the code (never a real password)', async () => {
    findByEmail.mockResolvedValue(null);
    create.mockResolvedValue(sampleUser());

    const result = await createUser({
      email: 'Reviewer@NCB.local',
      displayName: 'Demo Reviewer',
      role: 'reviewer'
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'reviewer@ncb.local', role: 'reviewer' })
    );
    // A real credential is set, but its value is never anything the caller chose or can see.
    expect(setUserPasswordMock).toHaveBeenCalledWith('usr_1', expect.any(String));
    expect(issueAccessCodeMock).toHaveBeenCalledWith('usr_1', 'account_activation');
    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: 'account_created',
        variables: expect.objectContaining({ activationCode: '482913' })
      })
    );
    expect(sendNotificationMock.mock.calls[0]![0].variables).not.toHaveProperty('temporaryPassword');
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

  it('resetUserPassword kills every session on the target account and emails a reset code (never a password)', async () => {
    findById.mockResolvedValue(sampleUser());

    await resetUserPassword('usr_1', 'usr_admin_demo');

    expect(revokeAllSessionsForUserMock).toHaveBeenCalledWith('usr_1');
    expect(issueAccessCodeMock).toHaveBeenCalledWith('usr_1', 'password_reset');
    expect(auditAppend).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'user_password_reset', entityId: 'usr_1' }));
    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: 'password_reset',
        variables: expect.objectContaining({ resetCode: '482913' })
      })
    );
    expect(sendNotificationMock.mock.calls[0]![0].variables).not.toHaveProperty('temporaryPassword');
  });

  it('resetUserPassword does nothing when the target user does not exist', async () => {
    findById.mockResolvedValue(null);

    await resetUserPassword('missing', 'usr_admin_demo');

    expect(revokeAllSessionsForUserMock).not.toHaveBeenCalled();
    expect(issueAccessCodeMock).not.toHaveBeenCalled();
    expect(auditAppend).not.toHaveBeenCalled();
  });
});
