import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../generated/client/index.js';
import { createSessionsRepository } from '../../sessions.js';

describe('sessions repository', () => {
  it('create() passes through the expected fields', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'sid_1' });
    const db = { session: { create } } as unknown as PrismaClient;

    const expiresAt = new Date('2026-01-01T00:15:00.000Z');
    await createSessionsRepository(db).create({
      id: 'sid_1',
      userId: 'user_1',
      csrfToken: 'csrf_1',
      expiresAt
    });

    expect(create).toHaveBeenCalledWith({
      data: { id: 'sid_1', userId: 'user_1', csrfToken: 'csrf_1', expiresAt }
    });
  });

  it('findById() only returns sessions that have not expired', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const db = { session: { findFirst } } as unknown as PrismaClient;

    await createSessionsRepository(db).findById('sid_1');

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'sid_1', expiresAt: { gt: expect.any(Date) } }
    });
  });

  it('touchExpiry() returns null instead of throwing when the session is gone', async () => {
    const update = vi.fn().mockRejectedValue(new Error('Record to update not found.'));
    const db = { session: { update } } as unknown as PrismaClient;

    const result = await createSessionsRepository(db).touchExpiry('missing', new Date());

    expect(result).toBeNull();
  });

  it('deleteExpired() returns the number of rows removed', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const db = { session: { deleteMany } } as unknown as PrismaClient;

    const removed = await createSessionsRepository(db).deleteExpired(new Date('2026-01-01T00:00:00.000Z'));

    expect(deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lte: new Date('2026-01-01T00:00:00.000Z') } }
    });
    expect(removed).toBe(3);
  });
});
