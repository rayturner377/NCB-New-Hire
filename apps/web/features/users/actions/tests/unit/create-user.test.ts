import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const createUserMock = vi.fn();
const revalidatePathMock = vi.fn();
const assertSameOriginMock = vi.fn();
const redirectMock = vi.fn();

vi.mock('next/cache', () => ({ revalidatePath: (...args: unknown[]) => revalidatePathMock(...args) }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    redirectMock(path);
    throw new Error('NEXT_REDIRECT');
  }
}));
vi.mock('../../../../../lib/assert-same-origin', () => ({
  assertSameOrigin: (...args: unknown[]) => assertSameOriginMock(...args)
}));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../services/users-service', async () => {
  const actual = await vi.importActual<typeof import('../../../services/users-service')>('../../../services/users-service');
  return {
    ...actual,
    createUser: (...args: unknown[]) => createUserMock(...args)
  };
});
// Covers both this test's own action-rate-limit.ts import and
// users-service.ts's transitive @ncb/auth/utils -> revoke-sessions.ts
// import — both ultimately depend on @ncb/redis's client, which throws at
// construction if REDIS_URL isn't set. Neither path is actually exercised
// by this test's assertions, so the stubs just need to exist and load.
vi.mock('@ncb/redis', () => ({
  redis: {},
  isRateLimited: async () => false,
  recordFailedAttempt: async () => undefined,
  clearAttempts: async () => undefined
}));

const { createUserAction } = await import('../../create-user');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const validFields = {
  email: 'doctor@ncb.local',
  firstName: 'Demo',
  lastName: 'Doctor',
  role: 'clinician'
};

describe('createUserAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    createUserMock.mockReset();
    revalidatePathMock.mockClear();
    redirectMock.mockClear();
    assertSameOriginMock.mockReset().mockResolvedValue(undefined);
  });

  it('rejects when there is no active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await createUserAction(null, formData(validFields));

    expect(result.ok).toBe(false);
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("rejects when the user's role lacks permission", async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user_1', role: 'clinician' } });

    const result = await createUserAction(null, formData(validFields));

    expect(result.ok).toBe(false);
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('lets a reviewer (STAFF_ACCOUNTS_MANAGE) create a doctor account', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', displayName: 'Demo Reviewer', role: 'reviewer' } });
    createUserMock.mockResolvedValue({ id: 'usr_1', role: 'clinician' });

    await expect(createUserAction(null, formData(validFields))).rejects.toThrow('NEXT_REDIRECT');

    expect(createUserMock).toHaveBeenCalled();
  });

  it('rejects a reviewer trying to create an admin account', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_reviewer_demo', role: 'reviewer' } });

    const result = await createUserAction(null, formData({ ...validFields, role: 'admin' }));

    expect(result.ok).toBe(false);
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('rejects invalid form input without creating anything', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'user_1', role: 'admin' } });

    const result = await createUserAction(null, formData({ ...validFields, email: 'not-an-email' }));

    expect(result.ok).toBe(false);
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it('creates the user, revalidates the role list, and redirects to it on success', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', displayName: 'Demo Admin', role: 'admin' } });
    createUserMock.mockResolvedValue({ id: 'usr_1', role: 'clinician' });

    await expect(createUserAction(null, formData(validFields))).rejects.toThrow('NEXT_REDIRECT');

    expect(createUserMock).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'doctor@ncb.local', displayName: 'Demo Doctor' }),
      'usr_admin_demo'
    );
    expect(revalidatePathMock).toHaveBeenCalledWith('/doctors');
    expect(redirectMock).toHaveBeenCalledWith('/doctors');
  });

  it('surfaces a duplicate email as a friendly error', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_admin_demo', displayName: 'Demo Admin', role: 'admin' } });
    const { DuplicateEmailError } = await import('../../../services/users-service');
    createUserMock.mockRejectedValue(new DuplicateEmailError());

    const result = await createUserAction(null, formData(validFields));

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/already exists/);
  });
});
