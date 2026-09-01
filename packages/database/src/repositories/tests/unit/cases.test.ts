import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../../../generated/client/index.js';
import { createCasesRepository } from '../../cases.js';

describe('cases repository', () => {
  it('transition() returns the new version on success', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ transition_medical_case: 2 }]);
    const db = { $queryRaw: queryRaw } as unknown as PrismaClient;

    const repository = createCasesRepository(db);
    const newVersion = await repository.transition('case_1', 1, 'reviewed', 'user_1');

    expect(newVersion).toBe(2);
    expect(queryRaw).toHaveBeenCalled();
  });

  it('transition() throws when the stored procedure returns no row', async () => {
    const db = { $queryRaw: vi.fn().mockResolvedValue([]) } as unknown as PrismaClient;

    const repository = createCasesRepository(db);
    await expect(repository.transition('case_1', 1, 'reviewed', 'user_1')).rejects.toThrow(
      'Medical case changed or does not exist'
    );
  });

  it('listAll() excludes soft-deleted cases', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { medicalCase: { findMany } } as unknown as PrismaClient;

    await createCasesRepository(db).listAll();

    expect(findMany).toHaveBeenCalledWith({ where: { deletedAt: null } });
  });

  it('findById() looks up a single non-deleted case', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'case_1' });
    const db = { medicalCase: { findFirst } } as unknown as PrismaClient;

    const found = await createCasesRepository(db).findById('case_1');

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'case_1', deletedAt: null } });
    expect(found).toEqual({ id: 'case_1' });
  });
});
