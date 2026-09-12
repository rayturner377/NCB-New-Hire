import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

/** A 6-digit numeric code (000000-999999), using crypto.randomInt for a uniform distribution rather than Math.random. */
export function generateAccessCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Only the hash is ever persisted — see AccessCode's own doc comment in schema.prisma for why. */
export function hashAccessCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/** Constant-time comparison against a stored hash — both sides are fixed-length sha256 hex digests, so buffer lengths always match. */
export function verifyAccessCodeHash(code: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashAccessCode(code), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}
