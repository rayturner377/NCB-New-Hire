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

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/**
 * Same AES-256-GCM primitive as encryptJson/decryptJson, but for raw binary
 * data (file attachments) instead of JSON-serializable values — round-tripping
 * a Buffer through JSON.stringify/base64 as encryptJson does would roughly
 * double storage size for a multi-MB file. Output is a single Buffer
 * (iv || authTag || ciphertext, concatenated) rather than a JSON envelope, so
 * it can be written to disk as-is.
 */
export function encryptBuffer(key: Buffer, plaintext: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptBuffer(key: Buffer, encrypted: Buffer): Buffer {
  if (encrypted.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Encrypted buffer is too short.');
  }
  const iv = encrypted.subarray(0, IV_LENGTH);
  const tag = encrypted.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = encrypted.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
