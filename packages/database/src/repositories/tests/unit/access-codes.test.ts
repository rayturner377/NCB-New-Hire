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
});
