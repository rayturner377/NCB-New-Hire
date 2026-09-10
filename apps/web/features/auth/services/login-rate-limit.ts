import { isRateLimited, recordFailedLogin, type RateLimitStore } from '@ncb/shared';
import { getSettings } from '../../settings/services/settings-service';

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

/** Reads the admin-configured max attempts/window (Settings → User) on every call rather than caching them — login is low-frequency enough that the extra settings read is negligible, unlike sessionTtlMs which would otherwise run on every single authenticated page load. */
export async function isLoginRateLimited(key: string): Promise<boolean> {
  const settings = await getSettings();
  return isRateLimited(loginAttempts, key, Date.now(), settings.userPolicy.loginMaxAttempts);
}

export async function recordFailedLoginAttempt(key: string): Promise<void> {
  const settings = await getSettings();
  recordFailedLogin(loginAttempts, key, Date.now(), settings.userPolicy.loginWindowMinutes * 60 * 1000);
}

export function clearLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}
