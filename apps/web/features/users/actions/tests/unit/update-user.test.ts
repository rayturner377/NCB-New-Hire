import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const updateUserMock = vi.fn();
const getUserRoleMock = vi.fn();
const revalidatePathMock = vi.fn();
const assertSameOriginMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({
  assertSameOrigin: (...args: unknown[]) => assertSameOriginMock(...args)
}));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args), requireFullSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/users-service', () => ({
  updateUser: (...args: unknown[]) => updateUserMock(...args),
  getUserRole: (...args: unknown[]) => getUserRoleMock(...args)
}));

const { updateUserAction } = await import('../../update-user');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const validFields = { userId: 'usr_1', role: 'clinician', firstName: 'Demo', lastName: 'Doctor' };

describe('updateUserAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    updateUserMock.mockReset();
    getUserRoleMock.mockReset();
    revalidatePathMock.mockClear();
    assertSameOriginMock.mockReset().mockResolvedValue(undefined);
  });

  it('rejects when there is no active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await updateUserAction(null, formData(validFields));

    expect(result.ok).toBe(false);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('rejects when the target account no longer exists', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });
    getUserRoleMock.mockResolvedValue(null);

    const result = await updateUserAction(null, formData(validFields));

    expect(result.ok).toBe(false);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('rejects when the caller lacks any account-management permission', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_doctor_demo', role: 'clinician' } });
    getUserRoleMock.mockResolvedValue('clinician');

    const result = await updateUserAction(null, formData(validFields));

    expect(result.ok).toBe(false);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('lets a reviewer (STAFF_ACCOUNTS_MANAGE) edit a doctor account', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getUserRoleMock.mockResolvedValue('clinician');
    updateUserMock.mockResolvedValue({ id: 'usr_1' });

    const result = await updateUserAction(null, formData(validFields));

    expect(result.ok).toBe(true);
    expect(updateUserMock).toHaveBeenCalledWith('usr_1', expect.objectContaining({ displayName: 'Demo Doctor' }), 'usr_reviewer_demo');
  });

  it('refuses to let a reviewer edit an admin account, regardless of what the form claims the role is', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });
    getUserRoleMock.mockResolvedValue('admin');

    // The target is actually an admin in the database even though a tampered form claims otherwise.
    const result = await updateUserAction(null, formData({ ...validFields, userId: 'usr_admin_1', role: 'clinician' }));

    expect(result.ok).toBe(false);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('updates the user and revalidates every role list', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', role: 'admin' } });
    getUserRoleMock.mockResolvedValue('clinician');
    updateUserMock.mockResolvedValue({ id: 'usr_1' });

    const result = await updateUserAction(null, formData(validFields));

    expect(result.ok).toBe(true);
    expect(revalidatePathMock).toHaveBeenCalledWith('/doctors');
  });
});
