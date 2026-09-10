'use server';

import { redirect } from 'next/navigation';
import { auditRepository } from '@ncb/database';
import { destroySession, getSession } from '../../../lib/session';

export async function logout(reason?: 'idle'): Promise<void> {
  const session = await getSession();
  if (session) {
    await auditRepository.append({
      eventType: reason === 'idle' ? 'logout_idle_timeout' : 'logout',
      actorUserId: session.user.id
    });
  }
  await destroySession();
  redirect(reason === 'idle' ? '/login?reason=idle' : '/login');
}
