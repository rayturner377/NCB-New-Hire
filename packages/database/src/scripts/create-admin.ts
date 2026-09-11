import { randomBytes, randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { usersRepository } from '../repositories/users.js';
import { prisma } from '../client.js';

/**
 * Production-safe first-admin bootstrap. Unlike seed-users.ts (a fixed set of
 * demo accounts sharing a hardcoded password, dev/demo only), this creates
 * exactly one real admin account with a freshly generated password printed
 * once — nothing here is hardcoded or reused across environments.
 *
 * Hashes with Better Auth's own scrypt implementation (`better-auth/crypto`,
 * the same function @ncb/auth's own hash() wraps) directly rather than
 * depending on @ncb/auth here — @ncb/auth depends on @ncb/database (for
 * prisma/usersRepository), so the reverse import would be circular. Creates
 * the credential Account row itself for the same reason.
 *
 * Usage: npm run db:create-admin -- <email> [displayName]
 */
function generatePassword(): string {
  // Base64url avoids characters a terminal/shell could mangle when the
  // operator copies this out, while still giving ~24 bytes of entropy.
  return randomBytes(24).toString('base64url');
}

async function main(): Promise<void> {
  const [emailArg, ...displayParts] = process.argv.slice(2);
  const email = String(emailArg || '').trim().toLowerCase();
  const displayName = displayParts.join(' ').trim() || email;

  if (!email || !email.includes('@') || email.length > 254) {
    throw new Error('Usage: npm run db:create-admin -- <email> [display name]');
  }

  const existing = await usersRepository.findByEmail(email);
  if (existing) {
    throw new Error(`A user with email ${email} already exists (role: ${existing.role}). Nothing created.`);
  }

  const password = generatePassword();
  const userId = randomUUID();

  await usersRepository.create({
    id: userId,
    email,
    displayName,
    role: 'admin',
    mustChangePassword: true
  });

  await prisma.account.create({
    data: {
      id: randomUUID(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: await hashPassword(password)
    }
  });

  console.log(`Created admin: ${email}`);
  console.log(`Temporary password (shown once): ${password}`);
  console.log('mustChangePassword is set — they will be required to set their own password on first login.');
}

main().catch((error) => {
  console.error('Failed to create admin:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
