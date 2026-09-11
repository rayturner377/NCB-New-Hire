import { isRateLimited, recordFailedAttempt, clearAttempts } from '@ncb/redis';
import { getSettings } from '../../settings/services/settings-service';

const KEY_PREFIX = 'login-rate-limit:';

/** Reads the admin-configured max attempts/window (Settings → User) on every call rather than caching them — login is low-frequency enough that the extra settings read is negligible, unlike sessionTtlMs which would otherwise run on every single authenticated page load. */
export async function isLoginRateLimited(key: string): Promise<boolean> {
  const settings = await getSettings();
  return isRateLimited(`${KEY_PREFIX}${key}`, settings.userPolicy.loginMaxAttempts);
}

export async function recordFailedLoginAttempt(key: string): Promise<void> {
  const settings = await getSettings();
  await recordFailedAttempt(`${KEY_PREFIX}${key}`, settings.userPolicy.loginWindowMinutes * 60 * 1000);
}

export async function clearLoginAttempts(key: string): Promise<void> {
  await clearAttempts(`${KEY_PREFIX}${key}`);
}
