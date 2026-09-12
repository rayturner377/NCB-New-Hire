import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const onMock = vi.fn();
const pingMock = vi.fn();
const constructorCalls: Array<{ url: string; options: unknown }> = [];

vi.mock('ioredis', () => ({
  Redis: class {
    constructor(url: string, options: unknown) {
      constructorCalls.push({ url, options });
    }
    on = onMock;
    ping = pingMock;
  }
}));

// client.ts loads the repo-root .env at import time (see its own docstring) —
// harmless here since dotenv never overrides an already-set process.env var,
// and every test below sets REDIS_URL explicitly before importing.
vi.mock('dotenv', () => ({ config: () => ({}) }));

const originalRedisUrl = process.env.REDIS_URL;
const originalNodeEnv = process.env.NODE_ENV;

let importCounter = 0;

async function importFreshClient() {
  vi.resetModules();
  // vi.resetModules() alone doesn't reliably bust Node's ESM cache for
  // repeated dynamic imports of the exact same specifier — a query-string
  // suffix forces each call to genuinely re-execute client.ts's module-level
  // code (the env check, client construction, the `on('error', ...)` call)
  // instead of silently returning the first test's already-evaluated module.
  importCounter += 1;
  return import(/* @vite-ignore */ `../../client.js?t=${importCounter}`);
}

describe('client', () => {
  beforeEach(() => {
    constructorCalls.length = 0;
    onMock.mockClear();
    pingMock.mockClear();
    process.env.NODE_ENV = 'test';
    // client.ts deliberately caches its instance on globalThis (see its own
    // docstring — surviving Fast Refresh re-evaluation in dev) whenever
    // NODE_ENV !== 'production', exactly the condition each test below runs
    // under. That's real global state, untouched by vi.resetModules() or the
    // query-busted re-import above — without clearing it here, every test
    // after the first would silently reuse the first test's already-cached
    // instance instead of exercising createClient() again.
    delete (globalThis as { redisClient?: unknown }).redisClient;
  });

  afterEach(() => {
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = originalRedisUrl;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('throws if REDIS_URL is not set', async () => {
    delete process.env.REDIS_URL;
    await expect(importFreshClient()).rejects.toThrow('REDIS_URL is not set.');
  });

  it('constructs the client with the configured URL and a bounded retry count', async () => {
    process.env.REDIS_URL = 'redis://:secret@localhost:6379';
    await importFreshClient();

    expect(constructorCalls).toHaveLength(1);
    expect(constructorCalls[0]).toEqual({
      url: 'redis://:secret@localhost:6379',
      options: { maxRetriesPerRequest: 3 }
    });
  });

  it('registers an error handler that logs rather than throwing', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    await importFreshClient();

    expect(onMock).toHaveBeenCalledWith('error', expect.any(Function));
    const errorHandler = onMock.mock.calls[0]![1] as (error: Error) => void;

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    errorHandler(new Error('connection refused'));
    expect(consoleErrorSpy).toHaveBeenCalledWith('Redis connection error:', 'connection refused');
    consoleErrorSpy.mockRestore();
  });

  it('pingRedis resolves when the server responds PONG', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    pingMock.mockResolvedValue('PONG');
    const { pingRedis } = await importFreshClient();

    await expect(pingRedis()).resolves.toBeUndefined();
  });

  it('pingRedis throws on an unexpected response', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    pingMock.mockResolvedValue('WAT');
    const { pingRedis } = await importFreshClient();

    await expect(pingRedis()).rejects.toThrow('Unexpected Redis PING response: WAT');
  });
});
