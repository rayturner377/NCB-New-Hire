import { randomUUID } from 'node:crypto';
import { usersRepository } from '../repositories/users.js';
import { prisma } from '../client.js';

/**
 * One-time backfill: creates a Better Auth credential Account row for every
 * existing AppUser, carrying their current PBKDF2 passwordRecord forward as
 * a JSON-serialized string — the legacy format @ncb/auth's custom verify()
 * already knows how to detect and check, lazily upgrading to scrypt on that
 * user's next successful login. No account is force-reset.
 *
 * Idempotent: skips any user that already has a credential Account (safe to
 * re-run, e.g. after adding a new user before this had run yet).
 *
 * `accountId` is set to the user's own id, matching Better Auth's own
 * credential-account lookup (its sign-in route matches on
 * `providerId === 'credential' && accountId === user.id`).
 */
async function main(): Promise<void> {
  const users = await usersRepository.listUsers();
  let created = 0;
  let skipped = 0;
  let noPassword = 0;

  for (const user of users) {
    const existing = await prisma.account.findFirst({
      where: { userId: user.id, providerId: 'credential' }
    });
    if (existing) {
      skipped++;
      continue;
    }

    if (!user.passwordRecord) {
      // No local password on file for this account (shouldn't normally
      // happen for a real user row, but don't fail the whole backfill over
      // one odd row) — nothing to carry forward, so nothing created.
      noPassword++;
      console.warn(`Skipped ${user.email}: no passwordRecord to migrate.`);
      continue;
    }

    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: 'credential',
        userId: user.id,
        password: JSON.stringify(user.passwordRecord)
      }
    });
    created++;
  }

  console.log(`Migrated ${created} account(s), skipped ${skipped} already-migrated, ${noPassword} with no password on file.`);
}

main().catch((error) => {
  console.error('Failed to migrate users to Better Auth:', error);
  process.exitCode = 1;
});
