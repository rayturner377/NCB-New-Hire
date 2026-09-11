import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const deleteUserMock = vi.fn();
const getUserRoleMock = vi.fn();
const revalidatePathMock = vi.fn();
const assertSameOriginMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({
  assertSameOrigin: (...args: unknown[]) => assertSameOriginMock(...args)
}));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/users-service', () => ({
  deleteUser: (...args: unknown[]) => deleteUserMock(...args),
  getUserRole: (...args: unknown[]) => getUserRoleMock(...args)
}));

const { deleteUserAction } = await import('../../delete-user');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('deleteUserAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    deleteUserMock.mockReset();
    getUserRoleMock.mockReset();
    revalidatePathMock.mockClear();
    assertSameOriginMock.mockReset().mockResolvedValue(undefined);
  });

  it('does nothing without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    await deleteUserAction(formData({ userId: 'usr_1' }));

    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it('refuses to let anyone delete their own account, regardless of role', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });

    await deleteUserAction(formData({ userId: 'usr_admin_demo' }));

    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(getUserRoleMock).not.toHaveBeenCalled();
  });

  it('does nothing when the caller lacks any account-management permission', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    getUserRoleMock.mockResolvedValue('clinician');

    await deleteUserAction(formData({ userId: 'usr_1' }));

    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it('lets a reviewer (STAFF_ACCOUNTS_MANAGE) delete a doctor account', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getUserRoleMock.mockResolvedValue('clinician');

    await deleteUserAction(formData({ userId: 'usr_1' }));

    expect(deleteUserMock).toHaveBeenCalledWith('usr_1', 'usr_reviewer_demo');
  });

  it('refuses to let a reviewer delete an admin account', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getUserRoleMock.mockResolvedValue('admin');

    await deleteUserAction(formData({ userId: 'usr_admin_1' }));

    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it('does nothing when the target account no longer exists', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });
    getUserRoleMock.mockResolvedValue(null);

    await deleteUserAction(formData({ userId: 'usr_gone' }));

    expect(deleteUserMock).not.toHaveBeenCalled();
  });

  it('deletes the target user and revalidates every role list', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });
    getUserRoleMock.mockResolvedValue('clinician');

    await deleteUserAction(formData({ userId: 'usr_1' }));

    expect(deleteUserMock).toHaveBeenCalledWith('usr_1', 'usr_admin_demo');
    expect(revalidatePathMock).toHaveBeenCalledWith('/doctors');
  });
});
