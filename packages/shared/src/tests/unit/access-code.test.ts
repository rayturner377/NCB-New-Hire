import { describe, expect, it } from 'vitest';
import { generateAccessCode, hashAccessCode, verifyAccessCodeHash } from '../../access-code.js';

describe('access-code', () => {
  it('generates a 6-digit numeric code, zero-padded', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateAccessCode();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it('hashAccessCode is deterministic for the same code', () => {
    expect(hashAccessCode('123456')).toBe(hashAccessCode('123456'));
  });

  it('hashAccessCode differs for different codes', () => {
    expect(hashAccessCode('123456')).not.toBe(hashAccessCode('654321'));
  });

  it('verifyAccessCodeHash accepts the correct code against its own hash', () => {
    const hash = hashAccessCode('482913');
    expect(verifyAccessCodeHash('482913', hash)).toBe(true);
  });

  it('verifyAccessCodeHash rejects a wrong code', () => {
    const hash = hashAccessCode('482913');
    expect(verifyAccessCodeHash('000000', hash)).toBe(false);
  });

  it('verifyAccessCodeHash does not throw on a malformed stored hash', () => {
    expect(() => verifyAccessCodeHash('482913', 'not-a-valid-hex-hash')).not.toThrow();
    expect(verifyAccessCodeHash('482913', 'not-a-valid-hex-hash')).toBe(false);
  });
});
