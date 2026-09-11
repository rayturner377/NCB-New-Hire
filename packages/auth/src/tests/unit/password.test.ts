import { describe, expect, it } from 'vitest';
import { makePasswordRecord } from '@ncb/shared';
import { hash, verify, tryParseLegacyRecord } from '../../password.js';

describe('hash', () => {
  it('produces a scrypt salt:hash string, never JSON', async () => {
    const hashed = await hash('SomePassword123!');
    expect(hashed).toMatch(/^[0-9a-f]+:[0-9a-f]+$/);
  });
});

describe('verify', () => {
  it('accepts a correct password against a native scrypt hash', async () => {
    const hashed = await hash('CorrectHorse1!');
    await expect(verify({ hash: hashed, password: 'CorrectHorse1!' })).resolves.toBe(true);
  });

  it('rejects a wrong password against a native scrypt hash', async () => {
    const hashed = await hash('CorrectHorse1!');
    await expect(verify({ hash: hashed, password: 'WrongPassword!' })).resolves.toBe(false);
  });

  it('accepts a correct password against a legacy PBKDF2 record', async () => {
    const stored = JSON.stringify(makePasswordRecord('LegacyPass123!'));
    await expect(verify({ hash: stored, password: 'LegacyPass123!' })).resolves.toBe(true);
  });

  it('rejects a wrong password against a legacy PBKDF2 record', async () => {
    const stored = JSON.stringify(makePasswordRecord('LegacyPass123!'));
    await expect(verify({ hash: stored, password: 'WrongPassword!' })).resolves.toBe(false);
  });

  it('treats a value that merely looks like JSON but isn\'t a legacy record as a native hash lookup, not a crash', async () => {
    await expect(verify({ hash: '{"not":"a password record"}', password: 'whatever' })).resolves.toBe(false);
  });

  // The legacy-to-scrypt upgrade itself lives in index.ts's
  // databaseHooks.session.create.after, not here — verify() stays pure
  // precisely because it never learns which account row it's checking (see
  // this file's own docstring), so it has nothing to safely update. That
  // hook is covered by a live integration test against a real Postgres
  // instance, not a unit test here — the scenario it guards against (two
  // accounts sharing a byte-identical legacy record only one of which just
  // signed in) isn't meaningfully mockable without re-implementing Prisma.
});

describe('tryParseLegacyRecord', () => {
  it('recognizes a real legacy PasswordRecord', () => {
    const record = makePasswordRecord('Whatever123!');
    expect(tryParseLegacyRecord(JSON.stringify(record))).toEqual(record);
  });

  it('returns null for a native scrypt hash', async () => {
    const hashed = await hash('Whatever123!');
    expect(tryParseLegacyRecord(hashed)).toBeNull();
  });

  it('returns null for JSON that is not a legacy record', () => {
    expect(tryParseLegacyRecord('{"not":"a password record"}')).toBeNull();
  });

  it('returns null for garbage input without throwing', () => {
    expect(tryParseLegacyRecord('not json at all')).toBeNull();
  });
});
