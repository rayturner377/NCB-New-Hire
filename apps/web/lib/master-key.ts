import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

/**
 * Ported from server.js's loadMasterKey() (~L5648-5668). Same fallback order:
 * APP_MASTER_KEY env var, then data/master.key on disk, then generate one.
 * Cached at module scope so it's only resolved once per server process,
 * matching the original's single module-level `masterKey` variable.
 */
const MASTER_KEY_PATH = path.join(process.cwd(), 'data', 'master.key');

let cachedKey: Buffer | undefined;

export function loadMasterKey(): Buffer {
  if (cachedKey) return cachedKey;

  if (process.env.APP_MASTER_KEY) {
    const key = Buffer.from(process.env.APP_MASTER_KEY, 'base64');
    if (key.length !== 32) {
      throw new Error('APP_MASTER_KEY must be a 32-byte base64 value.');
    }
    cachedKey = key;
    return key;
  }

  if (existsSync(MASTER_KEY_PATH)) {
    const key = Buffer.from(readFileSync(MASTER_KEY_PATH, 'utf8').trim(), 'base64');
    if (key.length !== 32) throw new Error('data/master.key is invalid.');
    cachedKey = key;
    return key;
  }

  const key = randomBytes(32);
  mkdirSync(path.dirname(MASTER_KEY_PATH), { recursive: true });
  writeFileSync(MASTER_KEY_PATH, `${key.toString('base64')}\n`, { mode: 0o600 });
  console.log(`A local encryption key was generated at ${MASTER_KEY_PATH}`);
  cachedKey = key;
  return key;
}
