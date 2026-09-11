'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auditRepository } from '@ncb/database';
import { auth } from '@ncb/auth';
import { getSession } from '../../../lib/session';

export async function logout(reason?: 'idle'): Promise<void> {
  const session = await getSession();
  if (session) {
    await auditRepository.append({
      eventType: reason === 'idle' ? 'logout_idle_timeout' : 'logout',
      actorUserId: session.user.id
    });
  }
  await auth.api.signOut({ headers: await headers() });
  redirect(reason === 'idle' ? '/login?reason=idle' : '/login');
}
