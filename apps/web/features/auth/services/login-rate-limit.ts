import { isRateLimited, recordFailedLogin, type RateLimitStore } from '@ncb/shared';

/**
 * Module-level store, same pattern server.js used (`loginAttempts = new
 * Map()`). NOTE: this carries the same known limitation the old in-memory
 * sessions had before they moved to Postgres (packages/database Session
 * model) — it won't survive a restart or work across more than one process.
 * Left in-memory deliberately for now: unlike sessions, a reset rate-limit
 * counter after a restart/redeploy is a minor availability nicety, not a
 * security or data-integrity issue, so it doesn't carry the same urgency.
 * Revisit if/when apps/web actually runs as more than one instance.
 */
const loginAttempts: RateLimitStore = new Map();

export function isLoginRateLimited(key: string): boolean {
  return isRateLimited(loginAttempts, key);
}

export function recordFailedLoginAttempt(key: string): void {
  recordFailedLogin(loginAttempts, key);
}

export function clearLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}
