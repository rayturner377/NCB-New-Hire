import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSettingsMock = vi.fn();
vi.mock('../../../../settings/services/settings-service', () => ({ getSettings: (...args: unknown[]) => getSettingsMock(...args) }));

const { clearLoginAttempts, isLoginRateLimited, recordFailedLoginAttempt } = await import('../../login-rate-limit');

describe('login rate limit', () => {
  beforeEach(() => {
    getSettingsMock.mockReset();
    getSettingsMock.mockResolvedValue({ userPolicy: { loginMaxAttempts: 8, loginWindowMinutes: 15 } });
  });

  it('does not limit a fresh key', async () => {
    expect(await isLoginRateLimited('203.0.113.1:fresh@ncb.local')).toBe(false);
  });

  it('limits after 8 failed attempts and clears on success', async () => {
    const key = '203.0.113.2:someone@ncb.local';
    for (let i = 0; i < 8; i += 1) await recordFailedLoginAttempt(key);

    expect(await isLoginRateLimited(key)).toBe(true);

    clearLoginAttempts(key);

    expect(await isLoginRateLimited(key)).toBe(false);
  });
});
