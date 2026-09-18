import { beforeEach, describe, expect, it, vi } from 'vitest';

const auditAppend = vi.fn();
const activateMock = vi.fn();
const notifyMock = vi.fn();
vi.mock('@ncb/auth', () => ({ auth: { api: { completeAccountActivation: (...args: unknown[]) => activateMock(...args) } } }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT:${url}`); } }));
vi.mock('../../../../notifications/services/notification-service', () => ({ sendNotification: (...args: unknown[]) => notifyMock(...args) }));
const revokeAllSessionsForUserMock = vi.fn();
const getSettingsMock = vi.fn();
const redeemAccessCodeMock = vi.fn();
const isAccessCodeRateLimitedMock = vi.fn();
const recordFailedAccessCodeAttemptMock = vi.fn();
const clearAccessCodeAttemptsMock = vi.fn();
const validatePasswordAgainstPolicyMock = vi.fn();

vi.mock('@ncb/database', () => ({
  auditRepository: { append: (...args: unknown[]) => auditAppend(...args) }
}));
vi.mock('@ncb/auth/utils', () => ({
  revokeAllSessionsForUser: (...args: unknown[]) => revokeAllSessionsForUserMock(...args)
}));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/client-ip', () => ({ getClientIp: async () => '203.0.113.5' }));
vi.mock('../../../../settings/password-policy', () => ({
  validatePasswordAgainstPolicy: (...args: unknown[]) => validatePasswordAgainstPolicyMock(...args)
}));
vi.mock('../../../../settings/services/settings-service', () => ({ getSettings: (...args: unknown[]) => getSettingsMock(...args) }));
vi.mock('../../../services/access-code-rate-limit', () => ({
  isAccessCodeRateLimited: (...args: unknown[]) => isAccessCodeRateLimitedMock(...args),
  recordFailedAccessCodeAttempt: (...args: unknown[]) => recordFailedAccessCodeAttemptMock(...args),
  clearAccessCodeAttempts: (...args: unknown[]) => clearAccessCodeAttemptsMock(...args)
}));
vi.mock('../../../services/access-codes-service', () => ({
  redeemAccessCode: (...args: unknown[]) => redeemAccessCodeMock(...args)
}));

const { redeemAccessCodeAction } = await import('../../redeem-access-code');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const validPassword = 'a-very-long-password';
const validFields = { email: 'jane@example.com', code: '482913', password: validPassword, confirmPassword: validPassword };

describe('redeemAccessCodeAction', () => {
  beforeEach(() => {
    auditAppend.mockReset();
    activateMock.mockReset().mockResolvedValue({ user: { id: 'usr_1', email: 'jane@example.com', name: 'Jane' } });
    notifyMock.mockReset().mockResolvedValue(undefined);
    revokeAllSessionsForUserMock.mockReset();
    getSettingsMock.mockReset();
    getSettingsMock.mockResolvedValue({ userPolicy: { minPasswordLength: 12, requireUppercase: false, requireNumber: false, requireSymbol: false } });
    redeemAccessCodeMock.mockReset();
    isAccessCodeRateLimitedMock.mockReset();
    isAccessCodeRateLimitedMock.mockResolvedValue(false);
    recordFailedAccessCodeAttemptMock.mockReset();
    clearAccessCodeAttemptsMock.mockReset();
    validatePasswordAgainstPolicyMock.mockReset();
    validatePasswordAgainstPolicyMock.mockReturnValue(null);
  });

  it('rejects invalid form input as a field error', async () => {
    const result = await redeemAccessCodeAction(null, formData({ ...validFields, code: '12' }));

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.code).toBeTruthy();
    expect(redeemAccessCodeMock).not.toHaveBeenCalled();
  });

  it('rejects mismatched password/confirmPassword', async () => {
    const result = await redeemAccessCodeAction(null, formData({ ...validFields, confirmPassword: 'does-not-match-1234' }));

    expect(result.ok).toBe(false);
    expect(redeemAccessCodeMock).not.toHaveBeenCalled();
  });

  it('rejects when rate-limited without calling redeemAccessCode', async () => {
    isAccessCodeRateLimitedMock.mockResolvedValue(true);

    const result = await redeemAccessCodeAction(null, formData(validFields));

    expect(result.ok).toBe(false);
    expect(redeemAccessCodeMock).not.toHaveBeenCalled();
  });

  it('rejects a password that fails the org policy even though it passes the schema', async () => {
    validatePasswordAgainstPolicyMock.mockReturnValue('Password must contain a symbol.');

    const result = await redeemAccessCodeAction(null, formData(validFields));

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.password).toBeTruthy();
    expect(redeemAccessCodeMock).not.toHaveBeenCalled();
  });

  it('records a failed attempt and returns the generic error when the code is wrong/expired', async () => {
    redeemAccessCodeMock.mockResolvedValue({ ok: false, error: 'That code is invalid or has expired. Request a new one and try again.' });

    const result = await redeemAccessCodeAction(null, formData(validFields));

    expect(result.ok).toBe(false);
    expect(recordFailedAccessCodeAttemptMock).toHaveBeenCalled();
    expect(revokeAllSessionsForUserMock).not.toHaveBeenCalled();
  });

  it('passes the new password straight through to redeemAccessCode, which owns the atomic claim + password change', async () => {
    redeemAccessCodeMock.mockResolvedValue({ ok: true, userId: 'usr_1', purpose: 'account_activation' });

    await expect(redeemAccessCodeAction(null, formData(validFields))).rejects.toThrow('REDIRECT:/');

    expect(redeemAccessCodeMock).toHaveBeenCalledWith('jane@example.com', '482913', validPassword);
  });

  it('on success, revokes every session and audits account_activated', async () => {
    redeemAccessCodeMock.mockResolvedValue({ ok: true, userId: 'usr_1', purpose: 'account_activation' });

    await expect(redeemAccessCodeAction(null, formData(validFields))).rejects.toThrow('REDIRECT:/');
    expect(activateMock).toHaveBeenCalledWith({ body: { userId: 'usr_1' }, headers: expect.any(Headers) });
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ templateKey: 'account_activated' }));
    expect(notifyMock).toHaveBeenCalledTimes(1);
    expect(revokeAllSessionsForUserMock).toHaveBeenCalledWith('usr_1');
    expect(clearAccessCodeAttemptsMock).toHaveBeenCalled();
    expect(auditAppend).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'account_activated', entityId: 'usr_1' }));
  });

  it('audits password_reset_completed for a reset-purpose redemption', async () => {
    redeemAccessCodeMock.mockResolvedValue({ ok: true, userId: 'usr_1', purpose: 'password_reset' });

    await redeemAccessCodeAction(null, formData(validFields));

    expect(auditAppend).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'password_reset_completed', entityId: 'usr_1' }));
    expect(activateMock).not.toHaveBeenCalled();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('offers ordinary sign-in when session creation fails after the password was saved', async () => {
    redeemAccessCodeMock.mockResolvedValue({ ok: true, userId: 'usr_1', purpose: 'account_activation' });
    activateMock.mockRejectedValue(new Error('storage unavailable'));
    expect(await redeemAccessCodeAction(null, formData(validFields))).toEqual(expect.objectContaining({ ok: false, passwordSaved: true }));
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('does not create a session when revoking existing sessions fails', async () => {
    redeemAccessCodeMock.mockResolvedValue({ ok: true, userId: 'usr_1', purpose: 'account_activation' });
    revokeAllSessionsForUserMock.mockRejectedValue(new Error('storage unavailable'));
    expect((await redeemAccessCodeAction(null, formData(validFields))).passwordSaved).toBe(true);
    expect(activateMock).not.toHaveBeenCalled();
  });

  it('keeps activation successful when its confirmation email cannot be queued', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      redeemAccessCodeMock.mockResolvedValue({ ok: true, userId: 'usr_1', purpose: 'account_activation' });
      notifyMock.mockRejectedValue(new Error('mail unavailable'));
      await expect(redeemAccessCodeAction(null, formData(validFields))).rejects.toThrow('REDIRECT:/');
      expect(log).toHaveBeenCalledWith('Account activation confirmation could not be queued.');
    } finally {
      log.mockRestore();
    }
  });
});
