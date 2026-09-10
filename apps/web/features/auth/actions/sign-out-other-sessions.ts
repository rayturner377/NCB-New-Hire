'use server';

import { revalidatePath } from 'next/cache';
import { sessionsRepository } from '@ncb/database';
import { assertSameOrigin } from '../../../lib/assert-same-origin';
import { getSession } from '../../../lib/session';

export interface SignOutOtherSessionsResult {
  ok: boolean;
  error?: string;
}

/**
 * Self-service "sign out of all other devices" — the current browser's own
 * session is deliberately kept alive (`exceptId`), only every other active
 * session on the account is killed. The natural response to "I think my
 * account is logged in somewhere I don't recognize," without needing an
 * admin to intervene.
 */
export async function signOutOtherSessionsAction(
  _prevState: SignOutOtherSessionsResult | null,
  _formData: FormData
): Promise<SignOutOtherSessionsResult> {
  await assertSameOrigin();

  const session = await getSession();
  if (!session) {
    return { ok: false, error: 'Your session has expired. Please sign in again.' };
  }

  await sessionsRepository.deleteAllForUser(session.user.id, session.sessionId);
  revalidatePath('/profile');
  return { ok: true };
}
