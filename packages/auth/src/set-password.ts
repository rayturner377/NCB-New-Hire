import { randomUUID } from 'node:crypto';
import { prisma } from '@ncb/database';
import { hash } from './password.js';

/**
 * Sets (creating the credential Account row if none exists yet) a user's
 * Better Auth password. Every password-setting path in this app — new
 * account creation, a user's own forced/self-service change, an admin
 * resetting someone else's — is admin/self-driven through this app's own
 * actions, never through Better Auth's own signUpEmail/changePassword API
 * surface, so none of those flows exist to do this automatically. Writing
 * here (not AppUser.passwordRecord, which Better Auth's sign-in never reads)
 * is what actually makes the password take effect.
 */
export async function setUserPassword(userId: string, newPassword: string): Promise<void> {
  const passwordHash = await hash(newPassword);
  const existing = await prisma.account.findFirst({ where: { userId, providerId: 'credential' } });

  if (existing) {
    await prisma.account.update({ where: { id: existing.id }, data: { password: passwordHash } });
    return;
  }

  await prisma.account.create({
    data: { id: randomUUID(), accountId: userId, providerId: 'credential', userId, password: passwordHash }
  });
}
