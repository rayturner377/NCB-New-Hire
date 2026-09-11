import { redis } from '@ncb/redis';

/** Must match index.ts's redisStorage({ ..., keyPrefix }) exactly. */
const KEY_PREFIX = 'ncb-auth:';

/**
 * Revokes every session for an arbitrary user, by id — for an admin
 * resetting someone *else's* password (features/users/services/users-service.ts's
 * resetUserPassword), where there's no "current session" to preserve the
 * way auth.api.revokeOtherSessions() assumes (that endpoint, and
 * revokeSessions, only ever act on the *calling* request's own session/user
 * — neither can target an arbitrary userId, and this app deliberately
 * doesn't adopt Better Auth's admin plugin, which would add that).
 *
 * This reaches directly into the Redis key shape Better Auth's own
 * secondaryStorage adapter uses internally (an `active-sessions-<userId>`
 * list of `{token, expiresAt}`, each token's session cached under its own
 * key) rather than a public API, because no public API covers this case.
 * If @better-auth/redis-storage or better-auth's internal-adapter key format
 * ever changes, this needs to change with it — there's no version-checked
 * guarantee here beyond the currently-pinned versions in package.json.
 */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  const listKey = `${KEY_PREFIX}active-sessions-${userId}`;
  const raw = await redis.get(listKey);

  if (raw) {
    const sessions = JSON.parse(raw) as Array<{ token: string }>;
    if (sessions.length > 0) {
      await redis.del(...sessions.map((s) => `${KEY_PREFIX}${s.token}`));
    }
  }

  await redis.del(listKey);
}
