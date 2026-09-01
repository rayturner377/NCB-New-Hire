import { randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { sessionsRepository, usersRepository } from '@ncb/database';
import type { AppUser } from '@ncb/database';

const SESSION_COOKIE = 'sid';

/** Ported from server.js parseSessionTimeoutMs (~L5711-5715): 5-480 minutes, default 15. */
function sessionTtlMs(): number {
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
  user: AppUser;
}

export async function createSession(userId: string): Promise<{ sessionId: string; csrfToken: string }> {
  const sessionId = randomToken(32);
  const csrfToken = randomToken(32);
  const expiresAt = new Date(Date.now() + sessionTtlMs());

  await sessionsRepository.create({ id: sessionId, userId, csrfToken, expiresAt });

  const store = await cookies();
  store.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: Math.floor(sessionTtlMs() / 1000)
  });

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

  return { sessionId, csrfToken: session.csrfToken, user };
}
