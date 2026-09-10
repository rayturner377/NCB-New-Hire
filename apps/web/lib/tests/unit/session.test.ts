import { afterEach, describe, expect, it, vi } from 'vitest';

const cookieStore = new Map<string, string>();
const cookiesApi = {
  set: vi.fn((name: string, value: string) => cookieStore.set(name, value)),
  get: vi.fn((name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined)),
  delete: vi.fn((name: string) => cookieStore.delete(name)),
  has: vi.fn((name: string) => cookieStore.has(name))
};

vi.mock('next/headers', () => ({ cookies: async () => cookiesApi }));

const sessionsRepository = {
  create: vi.fn(),
  findById: vi.fn(),
  touchExpiry: vi.fn(),
  delete: vi.fn()
};
const usersRepository = { findById: vi.fn() };
const rolePermissionsRepository = { listAll: vi.fn().mockResolvedValue([]) };

vi.mock('@ncb/database', () => ({ sessionsRepository, usersRepository, rolePermissionsRepository }));

const { createSession, destroySession, getSession, safeEqual } = await import('../../session');

describe('safeEqual', () => {
  it('returns true for identical strings', () => {
    expect(safeEqual('csrf-token-value', 'csrf-token-value')).toBe(true);
  });

  it('returns false for different strings, including different lengths', () => {
    expect(safeEqual('csrf-token-value', 'something-else')).toBe(false);
    expect(safeEqual('short', 'much-longer-value')).toBe(false);
  });
});

describe('createSession / getSession / destroySession', () => {
  it('creates a session row and sets the sid cookie', async () => {
    sessionsRepository.create.mockResolvedValue(undefined);

    const { sessionId, csrfToken } = await createSession('user_1');

    expect(sessionsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: sessionId, userId: 'user_1', csrfToken })
    );
    expect(cookiesApi.set).toHaveBeenCalledWith(
      'sid',
      sessionId,
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' })
    );
  });

  it('getSession returns null when there is no sid cookie', async () => {
    cookieStore.clear();
    expect(await getSession()).toBeNull();
  });

  it('getSession returns null when the session row does not exist', async () => {
    cookieStore.set('sid', 'sid_missing');
    sessionsRepository.findById.mockResolvedValue(null);

    expect(await getSession()).toBeNull();
  });

  it('getSession returns null when the user is deactivated', async () => {
    cookieStore.set('sid', 'sid_1');
    sessionsRepository.findById.mockResolvedValue({ userId: 'user_1', csrfToken: 'csrf_1' });
    usersRepository.findById.mockResolvedValue({ id: 'user_1', active: false });

    expect(await getSession()).toBeNull();
  });

  it('getSession returns the user and refreshes expiry on a valid session', async () => {
    cookieStore.set('sid', 'sid_1');
    sessionsRepository.findById.mockResolvedValue({ userId: 'user_1', csrfToken: 'csrf_1' });
    usersRepository.findById.mockResolvedValue({ id: 'user_1', active: true, displayName: 'Dr. Example' });

    const session = await getSession();

    expect(session?.user.displayName).toBe('Dr. Example');
    expect(sessionsRepository.touchExpiry).toHaveBeenCalledWith('sid_1', expect.any(Date));
  });

  it('destroySession deletes the row and clears the cookie', async () => {
    cookieStore.set('sid', 'sid_1');

    await destroySession();

    expect(sessionsRepository.delete).toHaveBeenCalledWith('sid_1');
    expect(cookiesApi.delete).toHaveBeenCalledWith('sid');
  });
});

describe('session cookie secure flag', () => {
  const originalValue = process.env.COOKIE_SECURE;

  afterEach(() => {
    if (originalValue === undefined) delete process.env.COOKIE_SECURE;
    else process.env.COOKIE_SECURE = originalValue;
  });

  it('defaults to secure when COOKIE_SECURE is not set at all', async () => {
    delete process.env.COOKIE_SECURE;
    sessionsRepository.create.mockResolvedValue(undefined);

    const { sessionId } = await createSession('user_1');

    expect(cookiesApi.set).toHaveBeenCalledWith('sid', sessionId, expect.objectContaining({ secure: true }));
  });

  it('is insecure only when COOKIE_SECURE is explicitly the literal string "false"', async () => {
    process.env.COOKIE_SECURE = 'false';
    sessionsRepository.create.mockResolvedValue(undefined);

    const { sessionId } = await createSession('user_1');

    expect(cookiesApi.set).toHaveBeenCalledWith('sid', sessionId, expect.objectContaining({ secure: false }));
  });

  it('stays secure for any other value, including the old "true"', async () => {
    process.env.COOKIE_SECURE = 'true';
    sessionsRepository.create.mockResolvedValue(undefined);

    const { sessionId } = await createSession('user_1');

    expect(cookiesApi.set).toHaveBeenCalledWith('sid', sessionId, expect.objectContaining({ secure: true }));
  });
});
