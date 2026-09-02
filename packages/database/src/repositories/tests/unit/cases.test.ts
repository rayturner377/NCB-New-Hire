import { randomBytes } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { MedicalCase, PrismaClient } from '../../../generated/client/index.js';
import { createCasesRepository } from '../../cases.js';

describe('cases repository', () => {
  const masterKey = randomBytes(32);

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

  it('listAll() excludes soft-deleted cases and decrypts each payload', async () => {
    const db = {
      medicalCase: { findMany: vi.fn().mockResolvedValue([{ id: 'case_1', casePayload: null }]) }
    } as unknown as PrismaClient;

    const rows = await createCasesRepository(db).listAll(masterKey);

    expect(db.medicalCase.findMany).toHaveBeenCalledWith({ where: { deletedAt: null } });
    expect(rows).toEqual([{ id: 'case_1', casePayload: null, payload: null }]);
  });

  it('findById() looks up a single non-deleted case', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'case_1', casePayload: null });
    const db = { medicalCase: { findFirst } } as unknown as PrismaClient;

    const found = await createCasesRepository(db).findById('case_1', masterKey);

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'case_1', deletedAt: null } });
    expect(found?.payload).toBeNull();
  });

  it('findById() returns null when no case matches', async () => {
    const db = { medicalCase: { findFirst: vi.fn().mockResolvedValue(null) } } as unknown as PrismaClient;
    expect(await createCasesRepository(db).findById('missing', masterKey)).toBeNull();
  });

  it('create() then findById() round-trips the encrypted case payload', async () => {
    let stored: MedicalCase | undefined;

    const db = {
      medicalCase: {
        create: vi.fn().mockImplementation(({ data }: { data: MedicalCase }) => {
          stored = data;
          return Promise.resolve(data);
        }),
        findFirst: vi.fn().mockImplementation(() => Promise.resolve(stored ?? null))
      }
    } as unknown as PrismaClient;

    const repository = createCasesRepository(db);
    await repository.create(
      { id: 'case_1', patientId: 'cand_1', route: 'doctor', status: 'sent_to_doctor', payload: { notes: 'x' } },
      masterKey
    );

    expect(db.medicalCase.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ id: 'case_1', patientId: 'cand_1', version: 1, payloadKeyVersion: 1 })
    });

    const found = await repository.findById('case_1', masterKey);
    expect(found?.payload).toEqual({ notes: 'x' });
  });
});
