import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const setUserActiveMock = vi.fn();
const getUserRoleMock = vi.fn();
const isOwnDelegateMock = vi.fn();
const revalidatePathMock = vi.fn();
const assertSameOriginMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({
  assertSameOrigin: (...args: unknown[]) => assertSameOriginMock(...args)
}));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/users-service', () => ({
  setUserActive: (...args: unknown[]) => setUserActiveMock(...args),
  getUserRole: (...args: unknown[]) => getUserRoleMock(...args),
  isOwnDelegate: (...args: unknown[]) => isOwnDelegateMock(...args)
}));

const { setUserActiveAction } = await import('../../set-user-active');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('setUserActiveAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    setUserActiveMock.mockReset();
    getUserRoleMock.mockReset();
    isOwnDelegateMock.mockReset();
    revalidatePathMock.mockClear();
    assertSameOriginMock.mockReset().mockResolvedValue(undefined);
  });

  it('does nothing without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    await setUserActiveAction(formData({ userId: 'usr_1', active: 'false' }));

    expect(setUserActiveMock).not.toHaveBeenCalled();
  });

  it('does nothing when the caller lacks any account-management permission', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_auditor_demo', role: 'auditor' } });
    getUserRoleMock.mockResolvedValue('clinician');

    await setUserActiveAction(formData({ userId: 'usr_1', active: 'false' }));

    expect(setUserActiveMock).not.toHaveBeenCalled();
  });

  it('lets a doctor deactivate the one delegate account linked to them', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    getUserRoleMock.mockResolvedValue('delegate');
    isOwnDelegateMock.mockResolvedValue(true);
    setUserActiveMock.mockResolvedValue({ id: 'usr_delegate_1', active: false });

    await setUserActiveAction(formData({ userId: 'usr_delegate_1', active: 'false' }));

    expect(isOwnDelegateMock).toHaveBeenCalledWith('usr_doctor_demo', 'usr_delegate_1');
    expect(setUserActiveMock).toHaveBeenCalledWith('usr_delegate_1', false, 'usr_doctor_demo');
    expect(revalidatePathMock).toHaveBeenCalledWith('/delegates');
  });

  it('refuses a doctor toggling a delegate linked to a different doctor', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    getUserRoleMock.mockResolvedValue('delegate');
    isOwnDelegateMock.mockResolvedValue(false);

    await setUserActiveAction(formData({ userId: 'usr_someone_elses_delegate', active: 'false' }));

    expect(setUserActiveMock).not.toHaveBeenCalled();
  });

  it("refuses a doctor toggling an account that isn't a delegate at all (e.g. another doctor)", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    getUserRoleMock.mockResolvedValue('clinician');
    isOwnDelegateMock.mockResolvedValue(false);

    await setUserActiveAction(formData({ userId: 'usr_other_doctor', active: 'false' }));

    expect(setUserActiveMock).not.toHaveBeenCalled();
  });

  it('lets a reviewer (STAFF_ACCOUNTS_MANAGE) toggle a doctor account', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getUserRoleMock.mockResolvedValue('clinician');
    setUserActiveMock.mockResolvedValue({ id: 'usr_1', active: false });

    await setUserActiveAction(formData({ userId: 'usr_1', active: 'false' }));

    expect(setUserActiveMock).toHaveBeenCalledWith('usr_1', false, 'usr_reviewer_demo');
  });

  it('refuses to let a reviewer toggle an admin account', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getUserRoleMock.mockResolvedValue('admin');

    await setUserActiveAction(formData({ userId: 'usr_admin_1', active: 'false' }));

    expect(setUserActiveMock).not.toHaveBeenCalled();
  });

  it('does nothing when the target account no longer exists', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });
    getUserRoleMock.mockResolvedValue(null);

    await setUserActiveAction(formData({ userId: 'usr_gone', active: 'false' }));

    expect(setUserActiveMock).not.toHaveBeenCalled();
  });

  it('refuses to let an admin deactivate their own account', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });

    await setUserActiveAction(formData({ userId: 'usr_admin_demo', active: 'false' }));

    expect(setUserActiveMock).not.toHaveBeenCalled();
  });

  it('toggles the target user and revalidates the list', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });
    getUserRoleMock.mockResolvedValue('clinician');
    setUserActiveMock.mockResolvedValue({ id: 'usr_1', active: false });

    await setUserActiveAction(formData({ userId: 'usr_1', active: 'false' }));

    expect(setUserActiveMock).toHaveBeenCalledWith('usr_1', false, 'usr_admin_demo');
    expect(revalidatePathMock).toHaveBeenCalledWith('/doctors');
  });
});
