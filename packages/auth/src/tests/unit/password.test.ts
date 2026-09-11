import { describe, expect, it } from 'vitest';
import { hash, verify } from '../../password.js';

describe('hash', () => {
  it('produces a scrypt salt:hash string', async () => {
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
});
