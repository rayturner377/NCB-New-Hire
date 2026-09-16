import { beforeEach, describe, expect, it, vi } from 'vitest';

const auditAppend = vi.fn();
const verifyTwoFactorOTPMock = vi.fn();
const revokeOtherSessionsMock = vi.fn();
const sendNotificationMock = vi.fn();
const assertSameOriginMock = vi.fn();
const isDeviceVerifyRateLimitedMock = vi.fn();
const recordFailedDeviceVerifyAttemptMock = vi.fn();
const clearDeviceVerifyAttemptsMock = vi.fn();
const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('@ncb/database', () => ({
  auditRepository: { append: (...args: unknown[]) => auditAppend(...args) }
}));
vi.mock('@ncb/auth', () => ({
  auth: {
    api: {
      verifyTwoFactorOTP: (...args: unknown[]) => verifyTwoFactorOTPMock(...args),
      revokeOtherSessions: (...args: unknown[]) => revokeOtherSessionsMock(...args)
    }
  }
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ getAll: () => [] }) }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirectMock(path) }));
vi.mock('../../../../../lib/assert-same-origin', () => ({
  assertSameOrigin: (...args: unknown[]) => assertSameOriginMock(...args)
}));
vi.mock('../../../../../lib/client-ip', () => ({ getClientIp: async () => '203.0.113.5' }));
vi.mock('../../../../notifications/services/notification-service', () => ({
  sendNotification: (...args: unknown[]) => sendNotificationMock(...args)
}));
vi.mock('../../../services/device-verification-rate-limit', () => ({
  isDeviceVerifyRateLimited: (...args: unknown[]) => isDeviceVerifyRateLimitedMock(...args),
  recordFailedDeviceVerifyAttempt: (...args: unknown[]) => recordFailedDeviceVerifyAttemptMock(...args),
  clearDeviceVerifyAttempts: (...args: unknown[]) => clearDeviceVerifyAttemptsMock(...args)
}));

const { verifyDeviceCodeAction } = await import('../../verify-device-code');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe('verifyDeviceCodeAction', () => {
  beforeEach(() => {
    auditAppend.mockReset();
    verifyTwoFactorOTPMock.mockReset();
    revokeOtherSessionsMock.mockReset();
    sendNotificationMock.mockReset();
    assertSameOriginMock.mockReset().mockResolvedValue(undefined);
    isDeviceVerifyRateLimitedMock.mockReset().mockResolvedValue(false);
    recordFailedDeviceVerifyAttemptMock.mockReset();
    clearDeviceVerifyAttemptsMock.mockReset();
    redirectMock.mockClear();
  });

  it('rejects a malformed code without calling verifyTwoFactorOTP', async () => {
    const result = await verifyDeviceCodeAction(null, formData({ code: '123' }));

    expect(result.ok).toBe(false);
    expect(verifyTwoFactorOTPMock).not.toHaveBeenCalled();
  });

  it('rejects once the IP-keyed verify budget is exhausted, without calling verifyTwoFactorOTP', async () => {
    isDeviceVerifyRateLimitedMock.mockResolvedValue(true);

    const result = await verifyDeviceCodeAction(null, formData({ code: '123456' }));

    expect(result).toEqual({ ok: false, error: 'Too many attempts. Try again later.' });
    expect(verifyTwoFactorOTPMock).not.toHaveBeenCalled();
  });

  it('on a wrong/expired code, audits the failure, records the attempt, and returns an error without redirecting', async () => {
    verifyTwoFactorOTPMock.mockRejectedValue(new Error('invalid'));

    const result = await verifyDeviceCodeAction(null, formData({ code: '123456' }));

    expect(result).toEqual({ ok: false, error: 'That code is invalid or has expired.' });
    expect(revokeOtherSessionsMock).not.toHaveBeenCalled();
    expect(sendNotificationMock).not.toHaveBeenCalled();
    expect(recordFailedDeviceVerifyAttemptMock).toHaveBeenCalled();
    expect(auditAppend).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'device_verification_failed' }));
  });

  it('on a correct code, always trusts the device, revokes every other session, emails the notice, and redirects home', async () => {
    verifyTwoFactorOTPMock.mockResolvedValue({
      token: 'session-token',
      user: { id: 'user_1', email: 'doctor@ncb.local', name: 'Demo Doctor' }
    });

    await expect(verifyDeviceCodeAction(null, formData({ code: '123456' }))).rejects.toThrow('NEXT_REDIRECT:/');

    expect(verifyTwoFactorOTPMock).toHaveBeenCalledWith(expect.objectContaining({ body: { code: '123456', trustDevice: true } }));
    expect(revokeOtherSessionsMock).toHaveBeenCalled();
    expect(clearDeviceVerifyAttemptsMock).toHaveBeenCalled();
    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: 'new_device_signed_in', to: 'doctor@ncb.local', entityId: 'user_1' })
    );
    expect(auditAppend).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'device_verified', actorUserId: 'user_1' }));
  });
});
