import { beforeEach, describe, expect, it, vi } from 'vitest';

const findById = vi.fn();
const auditAppend = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
const signInEmailMock = vi.fn();
const isLoginRateLimitedMock = vi.fn();
const recordFailedLoginAttemptMock = vi.fn();
const clearLoginAttemptsMock = vi.fn();

vi.mock('@ncb/database', () => ({
  usersRepository: { findById: (...args: unknown[]) => findById(...args) },
  auditRepository: { append: (...args: unknown[]) => auditAppend(...args) }
}));
vi.mock('@ncb/auth', () => ({
  auth: { api: { signInEmail: (...args: unknown[]) => signInEmailMock(...args) } }
}));
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirectMock(path) }));
vi.mock('../../../../../lib/client-ip', () => ({ getClientIp: async () => '203.0.113.5' }));
vi.mock('../../../services/login-rate-limit', () => ({
  isLoginRateLimited: (...args: unknown[]) => isLoginRateLimitedMock(...args),
  recordFailedLoginAttempt: (...args: unknown[]) => recordFailedLoginAttemptMock(...args),
  clearLoginAttempts: (...args: unknown[]) => clearLoginAttemptsMock(...args)
}));

const { login } = await import('../../login');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('login action', () => {
  beforeEach(() => {
    findById.mockReset();
    auditAppend.mockReset();
    redirectMock.mockClear();
    signInEmailMock.mockReset();
    isLoginRateLimitedMock.mockReset();
    isLoginRateLimitedMock.mockResolvedValue(false);
    recordFailedLoginAttemptMock.mockReset();
    clearLoginAttemptsMock.mockReset();
  });

  it('rejects invalid input without calling signInEmail', async () => {
    const result = await login(null, formData({ email: '', password: '' }));

    expect(result).toEqual({ ok: false, error: 'Enter your email and password.' });
    expect(signInEmailMock).not.toHaveBeenCalled();
  });

  it('rejects when rate-limited without calling signInEmail', async () => {
    isLoginRateLimitedMock.mockResolvedValue(true);

    const result = await login(null, formData({ email: 'doctor@ncb.local', password: 'whatever' }));

    expect(result).toEqual({ ok: false, error: 'Too many login attempts. Try again later.' });
    expect(signInEmailMock).not.toHaveBeenCalled();
  });

  /**
   * Covers every rejection reason Better Auth's signInEmail can throw for
   * (unknown email, no credential account, wrong password, or — via this
   * app's databaseHooks.session.create.before — a deactivated account): all
   * of them surface identically here as a thrown error, and login.ts's job
   * is just to map any of them to the same generic message + audit event,
   * not to distinguish which one happened. Which specific reasons Better
   * Auth itself treats this way is covered by packages/auth's own live
   * integration testing, not re-verified here.
   */
  it('rejects a failed sign-in with a generic error and logs login_failed', async () => {
    signInEmailMock.mockRejectedValue(new Error('rejected'));

    const result = await login(null, formData({ email: 'nobody@ncb.local', password: 'whatever' }));

    expect(result).toEqual({ ok: false, error: 'Invalid email or password.' });
    expect(recordFailedLoginAttemptMock).toHaveBeenCalled();
    expect(auditAppend).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'login_failed' }));
  });

  it('redirects and logs login_success on success', async () => {
    signInEmailMock.mockResolvedValue({ user: { id: 'user_1' } });
    findById.mockResolvedValue({ id: 'user_1', role: 'clinician' });

    await expect(
      login(null, formData({ email: 'doctor@ncb.local', password: 'correct horse battery staple' }))
    ).rejects.toThrow('NEXT_REDIRECT:/');

    expect(clearLoginAttemptsMock).toHaveBeenCalled();
    expect(auditAppend).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'login_success', actorUserId: 'user_1', details: { role: 'clinician' } })
    );
  });
});
