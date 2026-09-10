import { randomBytes, randomUUID } from 'node:crypto';
import { makePasswordRecord } from '@ncb/shared';
import { usersRepository } from '../repositories/users.js';

/**
 * Production-safe first-admin bootstrap. Unlike seed-users.ts (a fixed set of
 * demo accounts sharing a hardcoded password, dev/demo only), this creates
 * exactly one real admin account with a freshly generated password printed
 * once — nothing here is hardcoded or reused across environments.
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
  const passwordRecord = makePasswordRecord(password);

  await usersRepository.create({
    id: randomUUID(),
    email,
    displayName,
    // Matches apps/web/lib/permissions.ts's ROLES.ADMIN — not imported directly since
    // apps/web isn't a dependency of packages/database (same convention as seed-users.ts).
    role: 'admin',
    passwordRecord,
    mustChangePassword: true
  });

  console.log(`Created admin: ${email}`);
  console.log(`Temporary password (shown once): ${password}`);
  console.log('mustChangePassword is set — they will be required to set their own password on first login.');
}

main().catch((error) => {
  console.error('Failed to create admin:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
