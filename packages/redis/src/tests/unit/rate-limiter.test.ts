import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, number>();
const getMock = vi.fn(async (key: string) => (store.has(key) ? String(store.get(key)) : null));
const incrMock = vi.fn(async (key: string) => {
  const next = (store.get(key) ?? 0) + 1;
  store.set(key, next);
  return next;
});
const expireMock = vi.fn(async () => 1);
const delMock = vi.fn(async (key: string) => {
  const existed = store.delete(key);
  return existed ? 1 : 0;
});

vi.mock('../../client.js', () => ({
  redis: {
    get: (...args: [string]) => getMock(...args),
    incr: (...args: [string]) => incrMock(...args),
    expire: (...args: [string, number]) => expireMock(...args),
    del: (...args: [string]) => delMock(...args)
  }
}));

const { isRateLimited, recordFailedAttempt, clearAttempts } = await import('../../rate-limiter.js');

describe('isRateLimited / recordFailedAttempt / clearAttempts', () => {
  beforeEach(() => {
    store.clear();
    getMock.mockClear();
    incrMock.mockClear();
    expireMock.mockClear();
    delMock.mockClear();
  });

  it('is not limited for a key with no attempts', async () => {
    expect(await isRateLimited('k1', 3)).toBe(false);
  });

  it('sets an expiry only on the first recorded attempt, not subsequent ones', async () => {
    await recordFailedAttempt('k1', 60_000);
    expect(expireMock).toHaveBeenCalledTimes(1);
    expect(expireMock).toHaveBeenCalledWith('k1', 60);

    await recordFailedAttempt('k1', 60_000);
    expect(expireMock).toHaveBeenCalledTimes(1);
  });

  it('becomes limited once attempts reach the max', async () => {
    await recordFailedAttempt('k1', 60_000);
    await recordFailedAttempt('k1', 60_000);
    expect(await isRateLimited('k1', 3)).toBe(false);

    await recordFailedAttempt('k1', 60_000);
    expect(await isRateLimited('k1', 3)).toBe(true);
  });

  it('tracks each key independently', async () => {
    await recordFailedAttempt('k1', 60_000);
    expect(await isRateLimited('k1', 1)).toBe(true);
    expect(await isRateLimited('k2', 1)).toBe(false);
  });

  it('clearAttempts removes the key entirely', async () => {
    await recordFailedAttempt('k1', 60_000);
    expect(await isRateLimited('k1', 1)).toBe(true);

    await clearAttempts('k1');

    expect(await isRateLimited('k1', 1)).toBe(false);
  });
});
