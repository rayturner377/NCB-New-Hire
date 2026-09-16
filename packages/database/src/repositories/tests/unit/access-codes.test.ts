import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../generated/client/index.js';
import { createAccessCodesRepository } from '../../access-codes.js';

describe('access codes repository', () => {
  it('create() passes the input straight through as the row data', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'code_1' });
    const db = { accessCode: { create } } as unknown as PrismaClient;

    const input = { id: 'code_1', userId: 'usr_1', codeHash: 'abc', purpose: 'account_activation' as const, expiresAt: new Date() };
    await createAccessCodesRepository(db).create(input);

    expect(create).toHaveBeenCalledWith({ data: input });
  });

  it('findLatestActive() scopes to unused, unexpired rows for the user, newest first', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const db = { accessCode: { findFirst } } as unknown as PrismaClient;

    await createAccessCodesRepository(db).findLatestActive('usr_1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 'usr_1', usedAt: null, expiresAt: { gt: expect.any(Date) } },
      orderBy: { createdAt: 'desc' }
    });
  });

  it('findLatestActive() additionally scopes to a purpose when given one', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const db = { accessCode: { findFirst } } as unknown as PrismaClient;

    await createAccessCodesRepository(db).findLatestActive('usr_1', 'password_reset');

    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 'usr_1', purpose: 'password_reset', usedAt: null, expiresAt: { gt: expect.any(Date) } },
      orderBy: { createdAt: 'desc' }
    });
  });

  it('incrementAttempts() bumps attemptCount by one', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'code_1', attemptCount: 1 });
    const db = { accessCode: { update } } as unknown as PrismaClient;

    await createAccessCodesRepository(db).incrementAttempts('code_1');

    expect(update).toHaveBeenCalledWith({ where: { id: 'code_1' }, data: { attemptCount: { increment: 1 } } });
  });

  it('markUsed() and invalidate() both stamp usedAt', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'code_1', usedAt: new Date() });
    const db = { accessCode: { update } } as unknown as PrismaClient;
    const repository = createAccessCodesRepository(db);

    await repository.markUsed('code_1');
    await repository.invalidate('code_1');

    expect(update).toHaveBeenNthCalledWith(1, { where: { id: 'code_1' }, data: { usedAt: expect.any(Date) } });
    expect(update).toHaveBeenNthCalledWith(2, { where: { id: 'code_1' }, data: { usedAt: expect.any(Date) } });
  });

  it('invalidateAllActive() stamps usedAt on every currently unused, unexpired code for the user/purpose', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const db = { accessCode: { updateMany } } as unknown as PrismaClient;

    await createAccessCodesRepository(db).invalidateAllActive('usr_1', 'password_reset');

    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'usr_1', purpose: 'password_reset', usedAt: null, expiresAt: { gt: expect.any(Date) } },
      data: { usedAt: expect.any(Date) }
    });
  });

  describe('claimCodeAndSetPassword()', () => {
    /** Same fakeDb-with-a-real-$transaction shape as cases.test.ts's own submitAndTransition tests. */
    function fakeDb(overrides: { claimCount?: number; existingAccount?: { id: string } | null } = {}) {
      const accountUpdate = vi.fn().mockResolvedValue({});
      const accountCreate = vi.fn().mockResolvedValue({});
      const appUserUpdate = vi.fn().mockResolvedValue({});
      const tx = {
        accessCode: { updateMany: vi.fn().mockResolvedValue({ count: overrides.claimCount ?? 1 }) },
        account: {
          findFirst: vi.fn().mockResolvedValue(overrides.existingAccount === undefined ? null : overrides.existingAccount),
          update: accountUpdate,
          create: accountCreate
        },
        appUser: { update: appUserUpdate }
      };
      const db = { $transaction: vi.fn((callback: (tx: unknown) => unknown) => callback(tx)) } as unknown as PrismaClient;
      return { db, tx, accountUpdate, accountCreate, appUserUpdate };
    }

    const input = { codeId: 'code_1', userId: 'usr_1', passwordHash: 'hashed-password' };

    it('returns false without touching the account when the code is no longer claimable (lost the race)', async () => {
      const { db, accountUpdate, accountCreate, appUserUpdate } = fakeDb({ claimCount: 0 });

      const result = await createAccessCodesRepository(db).claimCodeAndSetPassword(input);

      expect(result).toBe(false);
      expect(accountUpdate).not.toHaveBeenCalled();
      expect(accountCreate).not.toHaveBeenCalled();
      expect(appUserUpdate).not.toHaveBeenCalled();
    });

    it('claims the code, updates an existing credential account, and clears mustChangePassword', async () => {
      const { db, tx, accountUpdate, accountCreate, appUserUpdate } = fakeDb({ existingAccount: { id: 'account_1' } });

      const result = await createAccessCodesRepository(db).claimCodeAndSetPassword(input);

      expect(result).toBe(true);
      expect((tx.accessCode.updateMany as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith({
        where: { id: 'code_1', usedAt: null, expiresAt: { gt: expect.any(Date) } },
        data: { usedAt: expect.any(Date) }
      });
      expect(accountUpdate).toHaveBeenCalledWith({ where: { id: 'account_1' }, data: { password: 'hashed-password' } });
      expect(accountCreate).not.toHaveBeenCalled();
      expect(appUserUpdate).toHaveBeenCalledWith({ where: { id: 'usr_1' }, data: { mustChangePassword: false } });
    });

    it('creates a credential account when the user has none yet', async () => {
      const { db, accountCreate, accountUpdate } = fakeDb({ existingAccount: null });

      const result = await createAccessCodesRepository(db).claimCodeAndSetPassword(input);

      expect(result).toBe(true);
      expect(accountUpdate).not.toHaveBeenCalled();
      expect(accountCreate).toHaveBeenCalledWith({
        data: { id: expect.any(String), accountId: 'usr_1', providerId: 'credential', userId: 'usr_1', password: 'hashed-password' }
      });
    });
  });
});
