import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../generated/client/index.js';
import { buildUserSearchWhere, createUsersRepository } from '../../users.js';

describe('users repository', () => {
  it('create() passes through the expected fields', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'user_1' });
    const db = { appUser: { create } } as unknown as PrismaClient;

    const repository = createUsersRepository(db);
    await repository.create({
      id: 'user_1',
      email: 'doctor@ncb.local',
      displayName: 'Dr. Example',
      role: 'clinician'
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

  describe('buildUserSearchWhere()', () => {
    it('always excludes soft-deleted accounts, even with no filters', () => {
      expect(buildUserSearchWhere({})).toEqual({ AND: [{ deletedAt: null }] });
    });

    it('scopes to a role', () => {
      expect(buildUserSearchWhere({ role: 'clinician' })).toEqual({ AND: [{ deletedAt: null }, { role: 'clinician' }] });
    });

    it('matches the query against displayName OR email, case-insensitively', () => {
      expect(buildUserSearchWhere({ query: 'jane' })).toEqual({
        AND: [
          { deletedAt: null },
          {
            OR: [
              { displayName: { contains: 'jane', mode: 'insensitive' } },
              { email: { contains: 'jane', mode: 'insensitive' } }
            ]
          }
        ]
      });
    });

    it('role and query compose as independent AND clauses', () => {
      const where = buildUserSearchWhere({ role: 'reviewer', query: 'jane' });
      expect(where.AND).toContainEqual({ role: 'reviewer' });
      expect(where.AND).toHaveLength(3);
    });
  });

  describe('search()', () => {
    it('paginates via skip/take and runs a matching count in parallel', async () => {
      const findMany = vi.fn().mockResolvedValue([{ id: 'user_1' }]);
      const count = vi.fn().mockResolvedValue(42);
      const db = { appUser: { findMany, count } } as unknown as PrismaClient;

      const result = await createUsersRepository(db).search({ role: 'clinician' }, 3, 8);

      const expectedWhere = buildUserSearchWhere({ role: 'clinician' });
      expect(findMany).toHaveBeenCalledWith({
        where: expectedWhere,
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
        skip: 16,
        take: 8
      });
      expect(count).toHaveBeenCalledWith({ where: expectedWhere });
      expect(result).toEqual({ rows: [{ id: 'user_1' }], total: 42 });
    });
  });

  describe('countByRole()', () => {
    it('counts total and active accounts for the role, excluding soft-deleted rows', async () => {
      const count = vi.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(7);
      const db = { appUser: { count } } as unknown as PrismaClient;

      const result = await createUsersRepository(db).countByRole('clinician');

      expect(count).toHaveBeenCalledWith({ where: { role: 'clinician', deletedAt: null } });
      expect(count).toHaveBeenCalledWith({ where: { role: 'clinician', deletedAt: null, active: true } });
      expect(result).toEqual({ total: 10, active: 7 });
    });
  });

  it('setActive() toggles the active flag', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'user_1', active: false });
    const db = { appUser: { update } } as unknown as PrismaClient;

    await createUsersRepository(db).setActive('user_1', false);

    expect(update).toHaveBeenCalledWith({ where: { id: 'user_1' }, data: { active: false } });
  });

  it('softDelete() sets deletedAt and deactivates rather than removing the row', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'user_1', active: false, deletedAt: new Date() });
    const db = { appUser: { update } } as unknown as PrismaClient;

    await createUsersRepository(db).softDelete('user_1');

    expect(update).toHaveBeenCalledWith({ where: { id: 'user_1' }, data: { deletedAt: expect.any(Date), active: false } });
  });
});
