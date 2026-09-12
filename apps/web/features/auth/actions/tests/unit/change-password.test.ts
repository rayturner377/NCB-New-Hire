import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const getSettingsMock = vi.fn();
const changePasswordMock = vi.fn();
const revokeOtherSessionsMock = vi.fn();
const redirectMock = vi.fn();

vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    redirectMock(path);
    throw new Error('NEXT_REDIRECT');
  }
}));
vi.mock('../../../../../lib/assert-same-origin', () => ({ assertSameOrigin: async () => undefined }));
vi.mock('../../../../../lib/session', () => ({ getSession: (...args: unknown[]) => getSessionMock(...args) }));
vi.mock('../../../../settings/services/settings-service', () => ({ getSettings: (...args: unknown[]) => getSettingsMock(...args) }));
vi.mock('../../../../users/services/users-service', () => ({
  changePassword: (...args: unknown[]) => changePasswordMock(...args)
}));
vi.mock('@ncb/auth', () => ({
  auth: { api: { revokeOtherSessions: (...args: unknown[]) => revokeOtherSessionsMock(...args) } }
}));

const { changePasswordAction } = await import('../../change-password');

function formData(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const validPassword = 'a-very-long-password';
const relaxedPolicy = { minPasswordLength: 12, requireUppercase: false, requireNumber: false, requireSymbol: false };

describe('changePasswordAction', () => {
  beforeEach(() => {
    getSessionMock.mockReset();
    getSettingsMock.mockReset();
    changePasswordMock.mockReset();
    revokeOtherSessionsMock.mockReset();
    redirectMock.mockClear();
    getSettingsMock.mockResolvedValue({ userPolicy: relaxedPolicy });
  });

  it('rejects without an active session', async () => {
    getSessionMock.mockResolvedValue(null);

    const result = await changePasswordAction(null, formData({ password: validPassword, confirmPassword: validPassword }));

    expect(result.ok).toBe(false);
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it('rejects invalid form input (too short) as a field error', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1' } });

    const result = await changePasswordAction(null, formData({ password: 'short', confirmPassword: 'short' }));

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.password).toBeTruthy();
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it('rejects mismatched password/confirmPassword', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1' } });

    const result = await changePasswordAction(null, formData({ password: validPassword, confirmPassword: 'does-not-match-1234' }));

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.confirmPassword).toBeTruthy();
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it('rejects a password that fails the org policy even though it passes the schema', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1' } });
    getSettingsMock.mockResolvedValue({ userPolicy: { ...relaxedPolicy, requireSymbol: true } });
    const noSymbolPassword = 'averylongpasswordwithnosymbols';

    const result = await changePasswordAction(null, formData({ password: noSymbolPassword, confirmPassword: noSymbolPassword }));

    expect(result.ok).toBe(false);
    expect(result.fieldErrors?.password).toContain('symbol');
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it('on success, changes the password, revokes other sessions, and redirects home', async () => {
    getSessionMock.mockResolvedValue({ user: { id: 'usr_1' } });

    await expect(
      changePasswordAction(null, formData({ password: validPassword, confirmPassword: validPassword }))
    ).rejects.toThrow('NEXT_REDIRECT');

    expect(changePasswordMock).toHaveBeenCalledWith('usr_1', validPassword);
    expect(revokeOtherSessionsMock).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith('/');
  });
});
