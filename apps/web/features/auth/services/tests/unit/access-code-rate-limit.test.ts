import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, number>();
const isRateLimitedMock = vi.fn(async (key: string, max: number) => (store.get(key) ?? 0) >= max);
const recordFailedAttemptMock = vi.fn(async (key: string) => {
  store.set(key, (store.get(key) ?? 0) + 1);
});
const clearAttemptsMock = vi.fn(async (key: string) => {
  store.delete(key);
});

vi.mock('@ncb/redis', () => ({
  isRateLimited: (...args: [string, number]) => isRateLimitedMock(...args),
  recordFailedAttempt: (...args: [string, number]) => recordFailedAttemptMock(...args),
  clearAttempts: (...args: [string]) => clearAttemptsMock(...args)
}));

const { clearAccessCodeAttempts, isAccessCodeRateLimited, recordFailedAccessCodeAttempt } = await import('../../access-code-rate-limit');

describe('access code rate limit', () => {
  beforeEach(() => {
    store.clear();
  });

  it('does not limit a fresh key', async () => {
    expect(await isAccessCodeRateLimited('203.0.113.1:fresh@ncb.local')).toBe(false);
  });

  it('limits after 10 failed attempts and clears on success', async () => {
    const key = '203.0.113.2:someone@ncb.local';
    for (let i = 0; i < 10; i += 1) await recordFailedAccessCodeAttempt(key);

    expect(await isAccessCodeRateLimited(key)).toBe(true);

    await clearAccessCodeAttempts(key);

    expect(await isAccessCodeRateLimited(key)).toBe(false);
  });

  it('namespaces keys so they never collide with a different consumer of the same underlying store', async () => {
    await recordFailedAccessCodeAttempt('shared-key');
    expect(recordFailedAttemptMock).toHaveBeenCalledWith('access-code-rate-limit:shared-key', 15 * 60 * 1000);
  });
});
