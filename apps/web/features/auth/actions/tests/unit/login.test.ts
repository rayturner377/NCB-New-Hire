import { beforeEach, describe, expect, it, vi } from 'vitest';

const findById = vi.fn();
const findByEmail = vi.fn();
const auditAppend = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
const signInEmailMock = vi.fn();
const sendTwoFactorOTPMock = vi.fn();
const revokeOtherSessionsMock = vi.fn();
const isLoginRateLimitedMock = vi.fn();
const recordFailedLoginAttemptMock = vi.fn();
const clearLoginAttemptsMock = vi.fn();
const isDeviceResendRateLimitedMock = vi.fn();
const recordDeviceResendAttemptMock = vi.fn();

vi.mock('@ncb/database', () => ({
  usersRepository: {
    findById: (...args: unknown[]) => findById(...args),
    findByEmail: (...args: unknown[]) => findByEmail(...args)
  },
  auditRepository: { append: (...args: unknown[]) => auditAppend(...args) }
}));
vi.mock('@ncb/auth', () => ({
  auth: {
    api: {
      signInEmail: (...args: unknown[]) => signInEmailMock(...args),
      sendTwoFactorOTP: (...args: unknown[]) => sendTwoFactorOTPMock(...args),
      revokeOtherSessions: (...args: unknown[]) => revokeOtherSessionsMock(...args)
    }
  }
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ getAll: () => [] }) }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirectMock(path) }));
vi.mock('../../../../../lib/client-ip', () => ({ getClientIp: async () => '203.0.113.5' }));
vi.mock('../../../services/login-rate-limit', () => ({
  isLoginRateLimited: (...args: unknown[]) => isLoginRateLimitedMock(...args),
  recordFailedLoginAttempt: (...args: unknown[]) => recordFailedLoginAttemptMock(...args),
  clearLoginAttempts: (...args: unknown[]) => clearLoginAttemptsMock(...args)
}));
vi.mock('../../../services/device-verification-rate-limit', () => ({
  isDeviceResendRateLimited: (...args: unknown[]) => isDeviceResendRateLimitedMock(...args),
  recordDeviceResendAttempt: (...args: unknown[]) => recordDeviceResendAttemptMock(...args)
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
    findByEmail.mockReset();
    auditAppend.mockReset();
    redirectMock.mockClear();
    signInEmailMock.mockReset();
    sendTwoFactorOTPMock.mockReset();
    revokeOtherSessionsMock.mockReset();
    isLoginRateLimitedMock.mockReset();
    isLoginRateLimitedMock.mockResolvedValue(false);
    recordFailedLoginAttemptMock.mockReset();
    clearLoginAttemptsMock.mockReset();
    isDeviceResendRateLimitedMock.mockReset();
    isDeviceResendRateLimitedMock.mockResolvedValue(false);
    recordDeviceResendAttemptMock.mockReset();
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

  it('redirects and logs login_success on success from a recognized device, and revokes every other session', async () => {
    signInEmailMock.mockResolvedValue({ user: { id: 'user_1' } });
    findById.mockResolvedValue({ id: 'user_1', role: 'clinician' });

    await expect(
      login(null, formData({ email: 'doctor@ncb.local', password: 'correct horse battery staple' }))
    ).rejects.toThrow('NEXT_REDIRECT:/');

    expect(clearLoginAttemptsMock).toHaveBeenCalled();
    expect(revokeOtherSessionsMock).toHaveBeenCalled();
    expect(sendTwoFactorOTPMock).not.toHaveBeenCalled();
    expect(auditAppend).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'login_success', actorUserId: 'user_1', details: { role: 'clinician' } })
    );
  });

  it('sends the device-verification OTP and redirects to /verify-device instead of granting access on an unrecognized device', async () => {
    signInEmailMock.mockResolvedValue({ twoFactorRedirect: true, twoFactorMethods: ['otp'] });
    findByEmail.mockResolvedValue({ id: 'user_1', role: 'clinician' });

    await expect(
      login(null, formData({ email: 'doctor@ncb.local', password: 'correct horse battery staple' }))
    ).rejects.toThrow('NEXT_REDIRECT:/verify-device');

    expect(sendTwoFactorOTPMock).toHaveBeenCalled();
    expect(revokeOtherSessionsMock).not.toHaveBeenCalled();
    expect(auditAppend).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'login_requires_device_verification', actorUserId: 'user_1', details: { role: 'clinician' } })
    );
  });

  it('rejects an unrecognized-device sign-in without sending a code once the resend budget is exhausted', async () => {
    signInEmailMock.mockResolvedValue({ twoFactorRedirect: true, twoFactorMethods: ['otp'] });
    isDeviceResendRateLimitedMock.mockResolvedValue(true);

    const result = await login(null, formData({ email: 'doctor@ncb.local', password: 'correct horse battery staple' }));

    expect(result).toEqual({ ok: false, error: 'Too many attempts. Try again later.' });
    expect(sendTwoFactorOTPMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
