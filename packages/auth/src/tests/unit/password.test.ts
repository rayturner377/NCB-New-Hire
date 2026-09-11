import { describe, expect, it, vi } from 'vitest';
import { makePasswordRecord } from '@ncb/shared';

vi.mock('@ncb/database', () => ({
  prisma: { account: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) } }
}));

const { hash, verify } = await import('../../password.js');
const { prisma } = await import('@ncb/database');

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

  it('accepts a correct password against a legacy PBKDF2 record and upgrades it', async () => {
    const record = makePasswordRecord('LegacyPass123!');
    const stored = JSON.stringify(record);

    const ok = await verify({ hash: stored, password: 'LegacyPass123!' });
    expect(ok).toBe(true);

    // The upgrade write is fire-and-forget (deliberately not awaited by
    // verify(), so a slow re-hash never delays the login response) and
    // scrypt hashing takes real wall-clock time on the thread pool — poll
    // rather than trust a single fixed delay.
    await vi.waitFor(() => expect(prisma.account.updateMany).toHaveBeenCalled());
    expect(prisma.account.updateMany).toHaveBeenCalledWith({
      where: { password: stored, providerId: 'credential' },
      data: { password: expect.stringMatching(/^[0-9a-f]+:[0-9a-f]+$/) }
    });
  });

  it('rejects a wrong password against a legacy PBKDF2 record without upgrading it', async () => {
    const record = makePasswordRecord('LegacyPass123!');
    const stored = JSON.stringify(record);
    vi.mocked(prisma.account.updateMany).mockClear();

    await expect(verify({ hash: stored, password: 'WrongPassword!' })).resolves.toBe(false);
    expect(prisma.account.updateMany).not.toHaveBeenCalled();
  });

  it('treats a value that merely looks like JSON but isn\'t a legacy record as a native hash lookup, not a crash', async () => {
    await expect(verify({ hash: '{"not":"a password record"}', password: 'whatever' })).resolves.toBe(false);
  });
});
