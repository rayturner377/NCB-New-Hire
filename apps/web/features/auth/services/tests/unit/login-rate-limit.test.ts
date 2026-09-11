import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSettingsMock = vi.fn();
const store = new Map<string, number>();
const isRateLimitedMock = vi.fn(async (key: string, max: number) => (store.get(key) ?? 0) >= max);
const recordFailedAttemptMock = vi.fn(async (key: string) => {
  store.set(key, (store.get(key) ?? 0) + 1);
});
const clearAttemptsMock = vi.fn(async (key: string) => {
  store.delete(key);
});

vi.mock('../../../../settings/services/settings-service', () => ({ getSettings: (...args: unknown[]) => getSettingsMock(...args) }));
vi.mock('@ncb/redis', () => ({
  isRateLimited: (...args: [string, number]) => isRateLimitedMock(...args),
  recordFailedAttempt: (...args: [string, number]) => recordFailedAttemptMock(...args),
  clearAttempts: (...args: [string]) => clearAttemptsMock(...args)
}));

const { clearLoginAttempts, isLoginRateLimited, recordFailedLoginAttempt } = await import('../../login-rate-limit');

describe('login rate limit', () => {
  beforeEach(() => {
    store.clear();
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

    await clearLoginAttempts(key);

    expect(await isLoginRateLimited(key)).toBe(false);
  });

  it('namespaces keys so they never collide with a different consumer of the same underlying store', async () => {
    await recordFailedLoginAttempt('shared-key');
    expect(recordFailedAttemptMock).toHaveBeenCalledWith('login-rate-limit:shared-key', 15 * 60 * 1000);
  });
});
