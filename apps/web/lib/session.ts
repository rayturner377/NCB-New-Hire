import { headers as nextHeaders } from 'next/headers';
import { auth } from '@ncb/auth';
import { usersRepository } from '@ncb/database';
import type { AppUser } from '@ncb/database';
import { getEffectivePermissions } from './effective-permissions';
import type { Permission } from './permissions';

/** Ported from server.js parseSessionTimeoutMs (~L5711-5715): 5-480 minutes, default 15. Exported so the client-side idle timer (session-idle-manager.tsx) can be configured with the same duration the server really enforces — @ncb/auth's own sessionTimeoutSeconds() computes the identical value from the same env var for Better Auth's session.expiresIn. */
export function sessionTtlMs(): number {
  const minutes = Number.parseInt(process.env.SESSION_TIMEOUT_MINUTES || '15', 10);
  const safeMinutes = Number.isFinite(minutes) ? Math.min(Math.max(minutes, 5), 480) : 15;
  return safeMinutes * 60 * 1000;
}

export interface AuthenticatedSession {
  /** `permissions` is resolved fresh on every getSession() call (role_permissions + this user's own overrides) — see lib/permissions.ts's getEffectivePermissions. hasPermission()/requirePermission() read it directly and never touch the database themselves. */
  user: AppUser & { permissions: Permission[] };
}

/**
 * Confirms a valid Better Auth session exists (Redis-backed — see
 * packages/auth), then fetches the full AppUser row directly, the same way
 * this function already did before Better Auth: role, active,
 * mustChangePassword, medicalProfile, and permissionOverrides all live only
 * on AppUser — @ncb/auth's user model declares none of them as
 * additionalFields, deliberately, so this is the one and only place they're
 * read from. No csrfToken here anymore: Better Auth's own origin/referer
 * checks plus Next.js Server Actions' own built-in Origin validation cover
 * what the old hand-rolled token did.
 */
export async function getSession(): Promise<AuthenticatedSession | null> {
  const authSession = await auth.api.getSession({ headers: await nextHeaders() });
  if (!authSession) return null;

  const user = await usersRepository.findById(authSession.user.id);
  if (!user || user.active === false) return null;

  const permissions = await getEffectivePermissions(user);
  return { user: { ...user, permissions } };
}
