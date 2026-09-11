import { isRateLimited, recordFailedAttempt } from '@ncb/redis';

/**
 * Generic per-action rate limiting for authenticated Server Actions beyond
 * login (file uploads, password resets, outbound email triggers) — reuses
 * the exact same Redis-backed fixed-window primitives login-rate-limit.ts
 * relies on (isRateLimited/recordFailedAttempt from @ncb/redis don't
 * actually know anything about "login" specifically, they're just a generic
 * counter).
 *
 * `namespace` keeps each call site's counters in their own Redis key space —
 * unlike the old in-memory version, where each createActionRateLimiter()
 * call got its own module-level Map "for free," every instance here shares
 * the same Redis instance, so without a distinct namespace two different
 * actions' rate limits for the same userId would collide.
 *
 * Keyed by the acting user's id, not IP — these are all authenticated
 * actions, and the actual abuse scenario is one compromised/malicious
 * account hammering an action, not an anonymous IP (which login's own
 * IP+email keying does need to worry about, since login has no session yet).
 */
export interface ActionRateLimiter {
  isLimited(userId: string): Promise<boolean>;
  recordAttempt(userId: string): Promise<void>;
}

export function createActionRateLimiter(namespace: string, maxAttempts: number, windowMs: number): ActionRateLimiter {
  const keyFor = (userId: string) => `action-rate-limit:${namespace}:${userId}`;
  return {
    isLimited: (userId) => isRateLimited(keyFor(userId), maxAttempts),
    recordAttempt: (userId) => recordFailedAttempt(keyFor(userId), windowMs)
  };
}
