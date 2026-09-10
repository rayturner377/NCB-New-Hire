import { isRateLimited, recordFailedLogin, type RateLimitStore } from '@ncb/shared';

/**
 * Generic per-action rate limiting for authenticated Server Actions beyond
 * login (file uploads, password resets, outbound email triggers) — reuses
 * the exact same fixed-window primitives login-rate-limit.ts already relies
 * on (isRateLimited/recordFailedLogin from @ncb/shared don't actually know
 * anything about "login" specifically, they're just a generic counter).
 *
 * Each call to createActionRateLimiter gets its own module-level store, so
 * one action's limiter can't be exhausted by traffic on a different one.
 * Same in-memory caveat as login's own limiter — lost on restart, doesn't
 * work across more than one server process — acceptable for the same reason
 * documented there: a reset counter after a redeploy is a minor availability
 * nicety, not a security or data-integrity issue. Revisit with a persistent
 * (DB-backed) store if this app ever runs as more than one instance.
 *
 * Keyed by the acting user's id, not IP — these are all authenticated
 * actions, and the actual abuse scenario is one compromised/malicious
 * account hammering an action, not an anonymous IP (which login's own
 * IP+email keying does need to worry about, since login has no session yet).
 */
export interface ActionRateLimiter {
  isLimited(userId: string): boolean;
  recordAttempt(userId: string): void;
}

export function createActionRateLimiter(maxAttempts: number, windowMs: number): ActionRateLimiter {
  const store: RateLimitStore = new Map();
  return {
    isLimited: (userId) => isRateLimited(store, userId, Date.now(), maxAttempts),
    recordAttempt: (userId) => recordFailedLogin(store, userId, Date.now(), windowMs)
  };
}
