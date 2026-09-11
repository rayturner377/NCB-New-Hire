import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { usersRepository } from '../repositories/users.js';
import { prisma } from '../client.js';

/**
 * Local-dev-only seed: one user per role (admin, reviewer, doctor/clinician,
 * patient). Idempotent: skips any email that already has a row instead of
 * failing on the unique constraint, so it's safe to re-run.
 *
 * Hashes with Better Auth's own scrypt implementation directly (see
 * create-admin.ts's docstring on why: @ncb/auth depends on @ncb/database,
 * so the reverse import would be circular) and creates each account's
 * credential Account row itself — without it, none of these could actually
 * sign in, since Better Auth's sign-in only ever checks the Account row.
 */
const DEV_PASSWORD = 'DevPassword123!';

const SEED_USERS = [
  { id: 'usr_admin_demo', email: 'admin@ncb.local', displayName: 'Demo Admin', role: 'admin' },
  { id: 'usr_reviewer_demo', email: 'reviewer@ncb.local', displayName: 'Demo Reviewer', role: 'reviewer' },
  { id: 'usr_auditor_demo', email: 'auditor@ncb.local', displayName: 'Demo Auditor', role: 'auditor' },
  { id: 'usr_doctor_demo', email: 'doctor@ncb.local', displayName: 'Demo Doctor', role: 'clinician' },
  { id: 'usr_patient_demo', email: 'patient@ncb.local', displayName: 'Demo Patient', role: 'patient' }
];

async function main(): Promise<void> {
  const passwordHash = await hashPassword(DEV_PASSWORD);

  for (const user of SEED_USERS) {
    const existing = await usersRepository.findByEmail(user.email);
    if (existing) {
      console.log(`Skipped ${user.email} (already exists).`);
      continue;
    }

    await usersRepository.create(user);
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: 'credential',
        userId: user.id,
        password: passwordHash
      }
    });
    console.log(`Created ${user.role}: ${user.email}`);
  }

  console.log(`\nAll seeded accounts use the password: ${DEV_PASSWORD}`);
}

main().catch((error) => {
  console.error('Failed to seed users:', error);
  process.exitCode = 1;
});
