const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

/**
 * Login rate limiting, extracted from server.js (isRateLimited/recordFailedLogin,
 * ~L5173-5190). The attempts store is now an explicit param instead of a closed-over
 * module-level Map, and `now` is injectable for deterministic tests.
 */
export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export type RateLimitStore = Map<string, RateLimitEntry>;

export function isRateLimited(store: RateLimitStore, key: string, now: number = Date.now()): boolean {
  const item = store.get(key);
  if (!item) return false;
  if (item.resetAt < now) {
    store.delete(key);
    return false;
  }
  return item.count >= MAX_ATTEMPTS;
}

export function recordFailedLogin(store: RateLimitStore, key: string, now: number = Date.now()): void {
  const current = store.get(key);
  if (!current || current.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + LOCKOUT_MS });
    return;
  }
  current.count += 1;
}
