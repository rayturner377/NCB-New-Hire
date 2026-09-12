import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { decryptBuffer, encryptBuffer } from '@ncb/shared';
import { loadMasterKey } from './master-key';

/**
 * Local-disk storage for case attachments (stamped assessment copies, and
 * whatever else lands on the case_attachments table later) — same "just a
 * file under data/" approach as lib/master-key.ts, rather than standing up
 * cloud object storage this app has no other use for yet. `storageKey` (the
 * column on CaseAttachment) is the filename here; the DB row is what makes
 * it addressable, so the on-disk name itself carries no meaning beyond
 * "unique". Files are encrypted at rest with the same AES-256-GCM
 * primitive/master key already used for case/candidate payloads — database
 * encryption alone didn't cover these, since attachment bytes live on disk,
 * not in a Postgres column.
 */
const ATTACHMENTS_DIR = path.join(process.cwd(), 'data', 'attachments');

function resolvePath(storageKey: string): string {
  // storageKey is always a server-generated randomUUID (see case-attachments-service.ts),
  // never a client-supplied value — this is defense in depth, not the primary guard.
  if (storageKey.includes('..') || storageKey.includes('/') || storageKey.includes('\\')) {
    throw new Error('Invalid attachment storage key.');
  }
  return path.join(ATTACHMENTS_DIR, storageKey);
}

export async function saveAttachmentFile(storageKey: string, data: Buffer): Promise<void> {
  await mkdir(ATTACHMENTS_DIR, { recursive: true });
  const encrypted = encryptBuffer(loadMasterKey(), data);
  await writeFile(resolvePath(storageKey), encrypted, { mode: 0o600 });
}

export async function readAttachmentFile(storageKey: string): Promise<Buffer> {
  const encrypted = await readFile(resolvePath(storageKey));
  return decryptBuffer(loadMasterKey(), encrypted);
}

export async function deleteAttachmentFile(storageKey: string): Promise<void> {
  await unlink(resolvePath(storageKey)).catch(() => undefined);
}
