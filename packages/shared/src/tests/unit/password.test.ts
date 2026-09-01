import { describe, expect, it } from 'vitest';
import { makePasswordRecord, verifyPassword, type PasswordRecord } from '../../password.js';

describe('password', () => {
  it('verifies the correct password', () => {
    const record = makePasswordRecord('correct horse battery staple');
    expect(verifyPassword('correct horse battery staple', record)).toBe(true);
  });

  it('rejects an incorrect password', () => {
    const record = makePasswordRecord('correct horse battery staple');
    expect(verifyPassword('wrong password', record)).toBe(false);
  });

  it('rejects an unrecognized algorithm', () => {
    const record = makePasswordRecord('a password');
    const tampered = { ...record, alg: 'MD5' } as unknown as PasswordRecord;
    expect(verifyPassword('a password', tampered)).toBe(false);
  });

  it('rejects a missing record', () => {
    expect(verifyPassword('anything', undefined)).toBe(false);
    expect(verifyPassword('anything', null)).toBe(false);
  });

  it('uses a different salt for each call with the same password', () => {
    const a = makePasswordRecord('same password');
    const b = makePasswordRecord('same password');
    expect(a.salt).not.toEqual(b.salt);
    expect(a.hash).not.toEqual(b.hash);
  });
});
