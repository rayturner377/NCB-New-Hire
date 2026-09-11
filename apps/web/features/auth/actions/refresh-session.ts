'use server';

import { headers } from 'next/headers';
import { auth } from '@ncb/auth';
import { sessionTtlMs } from '../../../lib/session';

export interface RefreshSessionResult {
  ok: boolean;
  expiresInMs?: number;
}

/**
 * Called by session-idle-manager.tsx while the user is active, throttled
 * client-side so this hits the server at most once a minute — not on every
 * mouse/keyboard event. Better Auth's own getSession() does the actual
 * sliding-refresh work internally (re-issuing the session with a fresh
 * `session.expiresIn` window once it's within `session.updateAge` seconds of
 * needing it — see packages/auth) and, via the nextCookies plugin, re-sets
 * the cookie itself; this action's job is just to trigger that check from a
 * context (a Server Action) that's actually allowed to set cookies.
 */
export async function refreshSessionAction(): Promise<RefreshSessionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? { ok: true, expiresInMs: sessionTtlMs() } : { ok: false };
}
