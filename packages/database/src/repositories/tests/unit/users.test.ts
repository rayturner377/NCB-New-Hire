import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../generated/client/index.js';
import { createUsersRepository } from '../../users.js';

describe('users repository', () => {
  it('create() passes through the expected fields', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'user_1' });
    const db = { appUser: { create } } as unknown as PrismaClient;

    const repository = createUsersRepository(db);
    await repository.create({
      id: 'user_1',
      email: 'doctor@ncb.local',
      displayName: 'Dr. Example',
      role: 'clinician',
      passwordRecord: { alg: 'PBKDF2-SHA256' }
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'user_1',
        email: 'doctor@ncb.local',
        role: 'clinician'
      })
    });
  });

  it('update() only includes fields that were actually provided', async () => {
    const update = vi.fn().mockResolvedValue({});
    const db = { appUser: { update } } as unknown as PrismaClient;

    const repository = createUsersRepository(db);
    await repository.update('user_1', { active: false });

    expect(update).toHaveBeenCalledWith({ where: { id: 'user_1' }, data: { active: false } });
  });

  it('findByEmail() excludes soft-deleted rows', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const db = { appUser: { findFirst } } as unknown as PrismaClient;

    const repository = createUsersRepository(db);
    await repository.findByEmail('someone@ncb.local');

    expect(findFirst).toHaveBeenCalledWith({
      where: { email: 'someone@ncb.local', deletedAt: null }
    });
  });

  it('findById() excludes soft-deleted rows', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'user_1' });
    const db = { appUser: { findFirst } } as unknown as PrismaClient;

    const found = await createUsersRepository(db).findById('user_1');

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'user_1', deletedAt: null } });
    expect(found).toEqual({ id: 'user_1' });
  });

  it('listUsers() excludes soft-deleted rows', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { appUser: { findMany } } as unknown as PrismaClient;

    await createUsersRepository(db).listUsers();

    expect(findMany).toHaveBeenCalledWith({ where: { deletedAt: null } });
  });

  it('setActive() toggles the active flag', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'user_1', active: false });
    const db = { appUser: { update } } as unknown as PrismaClient;

    await createUsersRepository(db).setActive('user_1', false);

    expect(update).toHaveBeenCalledWith({ where: { id: 'user_1' }, data: { active: false } });
  });
});
