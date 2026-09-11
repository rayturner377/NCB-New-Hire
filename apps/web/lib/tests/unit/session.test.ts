import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthSessionMock = vi.fn();
const findByIdMock = vi.fn();
const getEffectivePermissionsMock = vi.fn();

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@ncb/auth', () => ({ auth: { api: { getSession: (...args: unknown[]) => getAuthSessionMock(...args) } } }));
vi.mock('@ncb/database', () => ({ usersRepository: { findById: (...args: unknown[]) => findByIdMock(...args) } }));
vi.mock('../../effective-permissions', () => ({
  getEffectivePermissions: (...args: unknown[]) => getEffectivePermissionsMock(...args)
}));

const { getSession, sessionTtlMs } = await import('../../session');

describe('getSession', () => {
  beforeEach(() => {
    getAuthSessionMock.mockReset();
    findByIdMock.mockReset();
    getEffectivePermissionsMock.mockReset();
    getEffectivePermissionsMock.mockResolvedValue([]);
  });

  it('returns null when Better Auth reports no session', async () => {
    getAuthSessionMock.mockResolvedValue(null);

    expect(await getSession()).toBeNull();
    expect(findByIdMock).not.toHaveBeenCalled();
  });

  it('returns null when the session\'s user no longer exists', async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: 'user_1' } });
    findByIdMock.mockResolvedValue(null);

    expect(await getSession()).toBeNull();
  });

  it('returns null when the user is deactivated', async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: 'user_1' } });
    findByIdMock.mockResolvedValue({ id: 'user_1', active: false });

    expect(await getSession()).toBeNull();
  });

  it('returns the full AppUser row plus resolved permissions on a valid session', async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: 'user_1' } });
    findByIdMock.mockResolvedValue({ id: 'user_1', active: true, displayName: 'Dr. Example', role: 'clinician' });
    getEffectivePermissionsMock.mockResolvedValue(['cases:view']);

    const session = await getSession();

    expect(session?.user.displayName).toBe('Dr. Example');
    expect(session?.user.permissions).toEqual(['cases:view']);
  });
});

describe('sessionTtlMs', () => {
  const originalValue = process.env.SESSION_TIMEOUT_MINUTES;

  afterEach(() => {
    if (originalValue === undefined) delete process.env.SESSION_TIMEOUT_MINUTES;
    else process.env.SESSION_TIMEOUT_MINUTES = originalValue;
  });

  it('defaults to 15 minutes when unset', () => {
    delete process.env.SESSION_TIMEOUT_MINUTES;
    expect(sessionTtlMs()).toBe(15 * 60 * 1000);
  });

  it('clamps to the 5-480 minute range', () => {
    process.env.SESSION_TIMEOUT_MINUTES = '1';
    expect(sessionTtlMs()).toBe(5 * 60 * 1000);

    process.env.SESSION_TIMEOUT_MINUTES = '10000';
    expect(sessionTtlMs()).toBe(480 * 60 * 1000);
  });
});
