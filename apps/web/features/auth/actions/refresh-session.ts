'use server';

import { refreshSession } from '../../../lib/session';

export interface RefreshSessionResult {
  ok: boolean;
  expiresInMs?: number;
}

/** Called by session-idle-manager.tsx while the user is active, throttled client-side so this hits the server at most once a minute — not on every mouse/keyboard event. */
export async function refreshSessionAction(): Promise<RefreshSessionResult> {
  const result = await refreshSession();
  return result ? { ok: true, expiresInMs: result.expiresInMs } : { ok: false };
}
