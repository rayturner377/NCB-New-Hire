import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decryptJson, type EncryptedRecord } from '@ncb/shared';
import { prisma } from '../client.js';

const here = path.dirname(fileURLToPath(import.meta.url));
/** Same file apps/web/lib/master-key.ts falls back to for local dev — resolved from the monorepo root rather than process.cwd(), since `npm run backfill-candidate-columns -w @ncb/database` runs with this package as cwd, not apps/web. */
const FALLBACK_KEY_PATH = path.join(here, '..', '..', '..', '..', 'apps', 'web', 'data', 'master.key');

/**
 * Deliberately read-only about the key, unlike apps/web's own loadMasterKey() — a backfill script
 * must never generate a *new* random key on a cache miss, since that key couldn't decrypt any of
 * the existing profilePayload rows this script exists to read.
 */
function loadMasterKeyForScript(): Buffer {
  if (process.env.APP_MASTER_KEY) {
    const key = Buffer.from(process.env.APP_MASTER_KEY, 'base64');
    if (key.length !== 32) {
      throw new Error('APP_MASTER_KEY must be a 32-byte base64 value.');
    }
    return key;
  }
  if (existsSync(FALLBACK_KEY_PATH)) {
    const key = Buffer.from(readFileSync(FALLBACK_KEY_PATH, 'utf8').trim(), 'base64');
    if (key.length !== 32) {
      throw new Error(`${FALLBACK_KEY_PATH} is invalid.`);
    }
    return key;
  }
  throw new Error(
    `Could not find the app's master encryption key. Set APP_MASTER_KEY in the environment, or run this from an environment where ${FALLBACK_KEY_PATH} exists.`
  );
}

/**
 * One-time backfill for migration 0027_candidate_status_position_columns — populates the new plain
 * status/position columns on every existing patient_profiles row from its already-encrypted
 * profile_payload, since a plain SQL migration can't decrypt AES-256-GCM data itself. Safe to
 * re-run (idempotent: always overwrites with the current decrypted value). Run with:
 *   npm run build -w @ncb/database && npm run backfill-candidate-columns -w @ncb/database
 */
async function main(): Promise<void> {
  const masterKey = loadMasterKeyForScript();
  const rows = await prisma.patientProfile.findMany({ where: { profilePayload: { not: null } } });

  let updated = 0;
  for (const row of rows) {
    if (!row.profilePayload) continue;
    const record = JSON.parse(Buffer.from(row.profilePayload).toString('utf8')) as EncryptedRecord;
    const payload = decryptJson<{ status?: string; position?: string }>(masterKey, record);
    await prisma.patientProfile.update({
      where: { id: row.id },
      data: { status: payload.status ?? null, position: payload.position ?? null }
    });
    updated += 1;
  }

  console.log(`Backfilled status/position for ${updated} of ${rows.length} candidate profile(s) with a payload.`);
}

main()
  .catch((error) => {
    console.error('Failed to backfill candidate columns:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
