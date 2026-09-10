import { randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { sessionsRepository, usersRepository } from '@ncb/database';
import type { AppUser } from '@ncb/database';
import { getEffectivePermissions } from './effective-permissions';
import type { Permission } from './permissions';

const SESSION_COOKIE = 'sid';

/** Ported from server.js parseSessionTimeoutMs (~L5711-5715): 5-480 minutes, default 15. Exported so the client-side idle timer (session-idle-manager.tsx) can be configured with the same duration the server actually enforces. */
export function sessionTtlMs(): number {
  const minutes = Number.parseInt(process.env.SESSION_TIMEOUT_MINUTES || '15', 10);
  const safeMinutes = Number.isFinite(minutes) ? Math.min(Math.max(minutes, 5), 480) : 15;
  return safeMinutes * 60 * 1000;
}

/** Ported from server.js randomToken (~L5717-5719). */
function randomToken(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}

/** Ported from server.js safeEqual (~L5725-5730) — constant-time comparison. */
export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export interface AuthenticatedSession {
  sessionId: string;
  csrfToken: string;
  /** `permissions` is resolved fresh on every getSession() call (role_permissions + this user's own overrides) — see lib/permissions.ts's getEffectivePermissions. hasPermission()/requirePermission() read it directly and never touch the database themselves. */
  user: AppUser & { permissions: Permission[] };
}

/**
 * Secure by default — only plain local HTTP dev (no TLS) needs this off, and
 * that's opted into explicitly via .env's `COOKIE_SECURE=false`, not the
 * other way around. Previously defaulted to insecure (`=== 'true'`), which
 * meant a production deployment that simply forgot to set the env var would
 * silently send the session cookie over plain HTTP with no warning — the
 * failure mode of an unset var should be the safe one.
 */
function cookieIsSecure(): boolean {
  return process.env.COOKIE_SECURE !== 'false';
}

async function setSessionCookie(sessionId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'strict',
    secure: cookieIsSecure(),
    path: '/',
    maxAge: Math.floor(sessionTtlMs() / 1000)
  });
}

export async function createSession(userId: string): Promise<{ sessionId: string; csrfToken: string }> {
  const sessionId = randomToken(32);
  const csrfToken = randomToken(32);
  const expiresAt = new Date(Date.now() + sessionTtlMs());

  await sessionsRepository.create({ id: sessionId, userId, csrfToken, expiresAt });
  await setSessionCookie(sessionId);

  return { sessionId, csrfToken };
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await sessionsRepository.delete(sessionId);
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Reads the sid cookie, looks up the (unexpired) session, refreshes its
 * expiry ("sliding" timeout, matching server.js ~L3471), and returns the
 * associated user — or null if there is no valid session.
 */
export async function getSession(): Promise<AuthenticatedSession | null> {
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = await sessionsRepository.findById(sessionId);
  if (!session) return null;

  const user = await usersRepository.findById(session.userId);
  if (!user || user.active === false) return null;

  await sessionsRepository.touchExpiry(sessionId, new Date(Date.now() + sessionTtlMs()));

  const permissions = await getEffectivePermissions(user);
  return { sessionId, csrfToken: session.csrfToken, user: { ...user, permissions } };
}

/**
 * Slides the session forward, same as `getSession()`, but also re-issues the
 * `sid` cookie itself — `getSession()` alone extends the *database* row's
 * expiry (via `touchExpiry`), but the cookie's own `maxAge` was only ever set
 * once at login, so the browser would stop sending it ~sessionTtlMs after
 * login regardless of how recently the session was touched. Called from a
 * Server Action (session-idle-manager.tsx via refresh-session.ts), where
 * `cookies().set()` is actually allowed — unlike in a Server Component
 * render, which is why `getSession()` itself can't just always do this.
 */
export async function refreshSession(): Promise<{ expiresInMs: number } | null> {
  const session = await getSession();
  if (!session) return null;
  await setSessionCookie(session.sessionId);
  return { expiresInMs: sessionTtlMs() };
}
