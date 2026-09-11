import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * AES-256-GCM envelope, extracted verbatim from server.js (encryptJson/decryptJson,
 * ~L3376-3400) so the encryption-at-rest logic can be unit tested and reused by
 * the Postgres repositories without duplicating it.
 */
export interface EncryptedRecord {
  alg: 'AES-256-GCM';
  iv: string;
  tag: string;
  ciphertext: string;
}

export function encryptJson(key: Buffer, value: unknown): EncryptedRecord {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    alg: 'AES-256-GCM',
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
}

export function decryptJson<T = unknown>(key: Buffer, record: EncryptedRecord): T {
  if (!record || record.alg !== 'AES-256-GCM') {
    throw new Error('Unsupported encrypted record.');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, 'base64')),
    decipher.final()
  ]);
  return JSON.parse(plaintext.toString('utf8')) as T;
}
