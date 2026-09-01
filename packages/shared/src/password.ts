import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const ITERATIONS = 310000;
const KEY_LENGTH = 32;

/**
 * PBKDF2-SHA256 password hashing, extracted verbatim from server.js
 * (makePasswordRecord/verifyPassword, ~L4806-4824).
 */
export interface PasswordRecord {
  alg: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  hash: string;
}

export function makePasswordRecord(password: string): PasswordRecord {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha256');
  return {
    alg: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: salt.toString('base64'),
    hash: hash.toString('base64')
  };
}

export function verifyPassword(
  password: string,
  record: PasswordRecord | null | undefined
): boolean {
  if (!record || record.alg !== 'PBKDF2-SHA256') return false;
  const salt = Buffer.from(record.salt, 'base64');
  const expected = Buffer.from(record.hash, 'base64');
  const actual = pbkdf2Sync(password, salt, record.iterations, expected.length, 'sha256');
  return timingSafeEqual(expected, actual);
}
