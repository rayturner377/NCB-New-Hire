import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, number>();
const isRateLimitedMock = vi.fn(async (key: string, max: number) => (store.get(key) ?? 0) >= max);
const recordFailedAttemptMock = vi.fn(async (key: string) => {
  store.set(key, (store.get(key) ?? 0) + 1);
});

vi.mock('@ncb/redis', () => ({
  isRateLimited: (...args: [string, number]) => isRateLimitedMock(...args),
  recordFailedAttempt: (...args: [string, number]) => recordFailedAttemptMock(...args)
}));

const { createActionRateLimiter } = await import('../../action-rate-limit');

describe('createActionRateLimiter', () => {
  beforeEach(() => {
    store.clear();
    isRateLimitedMock.mockClear();
    recordFailedAttemptMock.mockClear();
  });

  it('is not limited before any attempts are recorded', async () => {
    const limiter = createActionRateLimiter('ns', 3, 60_000);
    expect(await limiter.isLimited('usr_1')).toBe(false);
  });

  it('becomes limited once attempts reach the max', async () => {
    const limiter = createActionRateLimiter('ns', 3, 60_000);
    await limiter.recordAttempt('usr_1');
    await limiter.recordAttempt('usr_1');
    expect(await limiter.isLimited('usr_1')).toBe(false);
    await limiter.recordAttempt('usr_1');
    expect(await limiter.isLimited('usr_1')).toBe(true);
  });

  it('tracks each user independently', async () => {
    const limiter = createActionRateLimiter('ns', 1, 60_000);
    await limiter.recordAttempt('usr_1');
    expect(await limiter.isLimited('usr_1')).toBe(true);
    expect(await limiter.isLimited('usr_2')).toBe(false);
  });

  it('namespaces so two different limiter instances never share counters for the same userId', async () => {
    const limiterA = createActionRateLimiter('action-a', 1, 60_000);
    const limiterB = createActionRateLimiter('action-b', 1, 60_000);
    await limiterA.recordAttempt('usr_1');
    expect(await limiterA.isLimited('usr_1')).toBe(true);
    expect(await limiterB.isLimited('usr_1')).toBe(false);

    expect(recordFailedAttemptMock).toHaveBeenCalledWith('action-rate-limit:action-a:usr_1', 60_000);
  });
});
