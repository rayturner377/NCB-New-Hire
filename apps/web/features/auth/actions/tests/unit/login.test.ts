import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePasswordRecord } from '@ncb/shared';

const findByEmail = vi.fn();
const auditAppend = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
const createSessionMock = vi.fn();
const isLoginRateLimitedMock = vi.fn();
const recordFailedLoginAttemptMock = vi.fn();
const clearLoginAttemptsMock = vi.fn();

vi.mock('@ncb/database', () => ({
  usersRepository: { findByEmail: (...args: unknown[]) => findByEmail(...args) },
  auditRepository: { append: (...args: unknown[]) => auditAppend(...args) }
}));
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirectMock(path) }));
vi.mock('../../../../../lib/client-ip', () => ({ getClientIp: async () => '203.0.113.5' }));
vi.mock('../../../../../lib/session', () => ({ createSession: (...args: unknown[]) => createSessionMock(...args) }));
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
    findByEmail.mockReset();
    auditAppend.mockReset();
    redirectMock.mockClear();
    createSessionMock.mockReset();
    isLoginRateLimitedMock.mockReset();
    isLoginRateLimitedMock.mockResolvedValue(false);
    recordFailedLoginAttemptMock.mockReset();
    clearLoginAttemptsMock.mockReset();
  });

  it('rejects invalid input without querying the database', async () => {
    const result = await login(null, formData({ email: '', password: '' }));

    expect(result).toEqual({ ok: false, error: 'Enter your email and password.' });
    expect(findByEmail).not.toHaveBeenCalled();
  });

  it('rejects an unknown email with a generic error and logs login_failed', async () => {
    findByEmail.mockResolvedValue(null);

    const result = await login(null, formData({ email: 'nobody@ncb.local', password: 'whatever' }));

    expect(result).toEqual({ ok: false, error: 'Invalid email or password.' });
    expect(auditAppend).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'login_failed' })
    );
  });

  it('rejects a deactivated user even with the correct password', async () => {
    const passwordRecord = makePasswordRecord('correct horse battery staple');
    findByEmail.mockResolvedValue({ id: 'user_1', active: false, passwordRecord, role: 'clinician' });

    const result = await login(
      null,
      formData({ email: 'doctor@ncb.local', password: 'correct horse battery staple' })
    );

    expect(result).toEqual({ ok: false, error: 'Invalid email or password.' });
    expect(createSessionMock).not.toHaveBeenCalled();
  });

  it('creates a session and redirects on success', async () => {
    const passwordRecord = makePasswordRecord('correct horse battery staple');
    findByEmail.mockResolvedValue({ id: 'user_1', active: true, passwordRecord, role: 'clinician' });

    await expect(
      login(null, formData({ email: 'doctor@ncb.local', password: 'correct horse battery staple' }))
    ).rejects.toThrow('NEXT_REDIRECT:/');

    expect(createSessionMock).toHaveBeenCalledWith('user_1');
    expect(auditAppend).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'login_success' }));
  });
});
