import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendTwoFactorOTPMock = vi.fn();
const assertSameOriginMock = vi.fn();
const isDeviceResendRateLimitedMock = vi.fn();
const recordDeviceResendAttemptMock = vi.fn();

vi.mock('@ncb/auth', () => ({
  auth: { api: { sendTwoFactorOTP: (...args: unknown[]) => sendTwoFactorOTPMock(...args) } }
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('../../../../../lib/assert-same-origin', () => ({
  assertSameOrigin: (...args: unknown[]) => assertSameOriginMock(...args)
}));
vi.mock('../../../../../lib/client-ip', () => ({ getClientIp: async () => '203.0.113.5' }));
vi.mock('../../../services/device-verification-rate-limit', () => ({
  isDeviceResendRateLimited: (...args: unknown[]) => isDeviceResendRateLimitedMock(...args),
  recordDeviceResendAttempt: (...args: unknown[]) => recordDeviceResendAttemptMock(...args)
}));

const { resendDeviceCodeAction } = await import('../../resend-device-code');

describe('resendDeviceCodeAction', () => {
  beforeEach(() => {
    sendTwoFactorOTPMock.mockReset();
    assertSameOriginMock.mockReset().mockResolvedValue(undefined);
    isDeviceResendRateLimitedMock.mockReset().mockResolvedValue(false);
    recordDeviceResendAttemptMock.mockReset();
  });

  it('resends the OTP and reports success', async () => {
    sendTwoFactorOTPMock.mockResolvedValue({ status: true });

    const result = await resendDeviceCodeAction();

    expect(result).toEqual({ ok: true });
    expect(sendTwoFactorOTPMock).toHaveBeenCalled();
    expect(recordDeviceResendAttemptMock).toHaveBeenCalled();
  });

  it('reports a friendly error when there is no pending verification to resend', async () => {
    sendTwoFactorOTPMock.mockRejectedValue(new Error('no pending 2fa'));

    const result = await resendDeviceCodeAction();

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('refuses to resend once the IP-keyed resend budget is exhausted', async () => {
    isDeviceResendRateLimitedMock.mockResolvedValue(true);

    const result = await resendDeviceCodeAction();

    expect(result).toEqual({ ok: false, error: 'Too many attempts. Try again later.' });
    expect(sendTwoFactorOTPMock).not.toHaveBeenCalled();
  });
});
