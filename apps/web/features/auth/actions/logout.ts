'use server';

import { redirect } from 'next/navigation';
import { auditRepository } from '@ncb/database';
import { destroySession, getSession } from '../../../lib/session';

export async function logout(): Promise<void> {
  const session = await getSession();
  if (session) {
    await auditRepository.append({
      eventType: 'logout',
      actorUserId: session.user.id
    });
  }
  await destroySession();
  redirect('/login');
}
